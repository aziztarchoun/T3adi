import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type {
  CastVoteInput,
  CreateReportInput,
  ReportFlagReason,
  ReportDto,
  ReportStatus,
  ReportType,
} from "@road-safety-map/shared";
import { pool } from "../db/client.js";

const LEGACY_DEVICE_TOKEN = "legacy-anonymous-device";

const FRESHNESS_WINDOWS_HOURS: Record<
  ReportType,
  { fresh: number; expires: number }
> = {
  flooding: { fresh: 2, expires: 8 },
  pothole: { fresh: 24 * 14, expires: 24 * 90 },
  blocked: { fresh: 1, expires: 6 },
  accident_obstacle: { fresh: 1, expires: 6 },
  other: { fresh: 6, expires: 24 },
};

export interface ReportBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface ReportFilters {
  type?: ReportType;
  severity?: ReportDto["severity"];
}

type ReportRow = {
  id: string;
  lat: number;
  lng: number;
  type: ReportType;
  severity: ReportDto["severity"];
  description: string | null;
  status: ReportStatus;
  created_at: Date;
  last_confirmed_at: Date | null;
  confirmation_count: string;
  dispute_count: string;
};

export function getReportFreshness(
  type: ReportType,
  lastConfirmedAt: Date | null,
  createdAt: Date,
  now = Date.now(),
) {
  const referenceTime = (lastConfirmedAt ?? createdAt).getTime();
  const ageHours = Math.max(0, (now - referenceTime) / 3_600_000);
  const window = FRESHNESS_WINDOWS_HOURS[type];
  const recencyFactor =
    ageHours <= window.fresh
      ? 1
      : Math.max(
          0,
          1 - (ageHours - window.fresh) / (window.expires - window.fresh),
        );

  return {
    ageMinutes: Math.floor(ageHours * 60),
    recencyFactor,
    expired: ageHours >= window.expires,
  };
}

function freshnessSummary(
  type: ReportType,
  lastConfirmedAt: Date | null,
  createdAt: Date,
) {
  const { ageMinutes } = getReportFreshness(type, lastConfirmedAt, createdAt);
  if (ageMinutes < 1) return "Just reported";
  if (ageMinutes === 1) return "Confirmed 1 minute ago";
  if (ageMinutes < 60) return `Confirmed ${ageMinutes} minutes ago`;
  const ageHours = Math.floor(ageMinutes / 60);
  return ageHours === 1
    ? "Confirmed 1 hour ago"
    : `Confirmed ${ageHours} hours ago`;
}

function toReportDto(row: ReportRow): ReportDto {
  const confirmationCount = Number(row.confirmation_count);
  const disputeCount = Number(row.dispute_count);
  const totalVotes = confirmationCount + disputeCount;
  const freshness = getReportFreshness(
    row.type,
    row.last_confirmed_at,
    row.created_at,
  );
  const status =
    row.status === "active" && freshness.expired ? "expired" : row.status;

  return {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    type: row.type,
    severity: row.severity,
    description: row.description,
    status,
    createdAt: row.created_at.toISOString(),
    lastConfirmedAt: row.last_confirmed_at?.toISOString() ?? null,
    confirmationCount,
    disputeCount,
    confidence: totalVotes
      ? Math.round(
          (confirmationCount / totalVotes) * 100 * freshness.recencyFactor,
        )
      : 0,
    freshnessSummary: freshnessSummary(
      row.type,
      row.last_confirmed_at,
      row.created_at,
    ),
  };
}

async function ensureDevice(client: PoolClient, token: string) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO devices (id, device_token)
     VALUES ($1, $2)
     ON CONFLICT (device_token) DO UPDATE SET device_token = EXCLUDED.device_token
     RETURNING id`,
    [randomUUID(), token],
  );
  return result.rows[0].id;
}

const reportSelect = `
  SELECT
    r.id,
    ST_Y(r.location::geometry) AS lat,
    ST_X(r.location::geometry) AS lng,
    r.type,
    r.severity,
    r.description,
    r.status,
    r.created_at,
    r.last_confirmed_at,
    COUNT(c.id) FILTER (WHERE c.vote = 'confirm') AS confirmation_count,
    COUNT(c.id) FILTER (WHERE c.vote = 'dispute') AS dispute_count
  FROM reports r
  LEFT JOIN confirmations c ON c.report_id = r.id
`;

export async function listReports(
  bounds?: ReportBounds,
  filters: ReportFilters = {},
): Promise<ReportDto[]> {
  const conditions = ["r.status <> 'hidden'"];
  const values: Array<number | string> = [];
  if (bounds) {
    const start = values.length + 1;
    values.push(bounds.west, bounds.south, bounds.east, bounds.north);
    conditions.push(
      `ST_Intersects(r.location, ST_MakeEnvelope($${start}, $${start + 1}, $${start + 2}, $${start + 3}, 4326)::geography)`,
    );
  }
  if (filters.type) {
    values.push(filters.type);
    conditions.push(`r.type = $${values.length}`);
  }
  if (filters.severity) {
    values.push(filters.severity);
    conditions.push(`r.severity = $${values.length}`);
  }
  const result = await pool.query<ReportRow>(
    `${reportSelect}
     WHERE ${conditions.join(" AND ")}
     GROUP BY r.id
     ORDER BY r.created_at DESC`,
    values,
  );
  return result.rows
    .map(toReportDto)
    .filter((report) => report.status !== "expired");
}

export async function createReport(
  input: CreateReportInput,
  deviceToken = LEGACY_DEVICE_TOKEN,
): Promise<ReportDto> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const deviceId = await ensureDevice(client, deviceToken);
    const duplicate = await client.query<{ id: string }>(
      `SELECT id
       FROM reports
       WHERE type = $1
         AND status = 'active'
         AND created_at >= now() - interval '30 minutes'
         AND ST_DWithin(
           location,
           ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
           75
         )
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [input.type, input.lng, input.lat],
    );

    if (duplicate.rows[0]) {
      await client.query(
        `INSERT INTO confirmations (id, report_id, device_id, vote)
         VALUES ($1, $2, $3, 'confirm')
         ON CONFLICT (report_id, device_id)
         DO UPDATE SET vote = 'confirm', created_at = now()`,
        [randomUUID(), duplicate.rows[0].id, deviceId],
      );
      await client.query(
        "UPDATE reports SET last_confirmed_at = now() WHERE id = $1",
        [duplicate.rows[0].id],
      );
      const existing = await client.query<ReportRow>(
        `${reportSelect} WHERE r.id = $1 GROUP BY r.id`,
        [duplicate.rows[0].id],
      );
      await client.query("COMMIT");
      return toReportDto(existing.rows[0]);
    }

    const id = randomUUID();
    await client.query(
      `INSERT INTO reports
       (id, reporter_device_id, location, type, severity, description, last_confirmed_at)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6, $7, now())`,
      [
        id,
        deviceId,
        input.lng,
        input.lat,
        input.type,
        input.severity,
        input.description ?? null,
      ],
    );
    await client.query(
      `INSERT INTO confirmations (id, report_id, device_id, vote)
       VALUES ($1, $2, $3, 'confirm')`,
      [randomUUID(), id, deviceId],
    );
    const created = await client.query<ReportRow>(
      `${reportSelect} WHERE r.id = $1 GROUP BY r.id`,
      [id],
    );
    await client.query("COMMIT");
    return toReportDto(created.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function castVote(
  reportId: string,
  input: CastVoteInput,
  deviceToken = LEGACY_DEVICE_TOKEN,
): Promise<ReportDto | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const deviceId = await ensureDevice(client, deviceToken);
    const reportExists = await client.query(
      "SELECT 1 FROM reports WHERE id = $1",
      [reportId],
    );
    if (!reportExists.rowCount) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `INSERT INTO confirmations (id, report_id, device_id, vote)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (report_id, device_id)
       DO UPDATE SET vote = EXCLUDED.vote, created_at = now()`,
      [randomUUID(), reportId, deviceId, input.vote],
    );

    if (input.vote === "confirm") {
      await client.query(
        "UPDATE reports SET last_confirmed_at = now() WHERE id = $1",
        [reportId],
      );
    } else if (input.vote === "resolved") {
      await client.query(
        "UPDATE reports SET status = 'resolved', resolved_at = now() WHERE id = $1",
        [reportId],
      );
    }

    const updated = await client.query<ReportRow>(
      `${reportSelect} WHERE r.id = $1 GROUP BY r.id`,
      [reportId],
    );
    await client.query("COMMIT");
    return updated.rows[0] ? toReportDto(updated.rows[0]) : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function flagReport(
  reportId: string,
  reason: ReportFlagReason,
  deviceToken = LEGACY_DEVICE_TOKEN,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const deviceId = await ensureDevice(client, deviceToken);
    const reportExists = await client.query(
      "SELECT 1 FROM reports WHERE id = $1",
      [reportId],
    );
    if (!reportExists.rowCount) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `INSERT INTO flags (id, report_id, device_id, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (report_id, device_id, reason) DO NOTHING`,
      [randomUUID(), reportId, deviceId, reason],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
