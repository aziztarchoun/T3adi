import { randomUUID } from "node:crypto";
import { pool } from "../db/client.js";

export interface OpenFlagDto {
  id: string;
  reportId: string;
  reason: "inaccurate" | "spam" | "offensive";
  createdAt: string;
  reportType: string;
  reportSeverity: string;
  reportStatus: string;
  reportDescription: string | null;
  flagCount: number;
}

export async function listOpenFlags(): Promise<OpenFlagDto[]> {
  const result = await pool.query<{
    id: string;
    report_id: string;
    reason: OpenFlagDto["reason"];
    created_at: Date;
    report_type: string;
    report_severity: string;
    report_status: string;
    report_description: string | null;
    flag_count: string;
  }>(
    `SELECT
       f.id,
       f.report_id,
       f.reason,
       f.created_at,
       r.type AS report_type,
       r.severity AS report_severity,
       r.status AS report_status,
       r.description AS report_description,
       COUNT(all_flags.id) AS flag_count
     FROM flags f
     JOIN reports r ON r.id = f.report_id
     JOIN flags all_flags ON all_flags.report_id = f.report_id
     WHERE f.resolved = false
     GROUP BY f.id, r.id
     ORDER BY f.created_at DESC
     LIMIT 100`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    reportId: row.report_id,
    reason: row.reason,
    createdAt: row.created_at.toISOString(),
    reportType: row.report_type,
    reportSeverity: row.report_severity,
    reportStatus: row.report_status,
    reportDescription: row.report_description,
    flagCount: Number(row.flag_count),
  }));
}

export async function setReportVisibility(
  reportId: string,
  status: "active" | "hidden",
  action: "hide" | "unhide",
): Promise<{ id: string; status: string } | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query<{ id: string; status: string }>(
      "UPDATE reports SET status = $2, resolved_at = CASE WHEN $2 = 'hidden' THEN now() ELSE NULL END WHERE id = $1 RETURNING id, status",
      [reportId, status],
    );
    if (!updated.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `INSERT INTO moderation_actions (id, report_id, action)
       VALUES ($1, $2, $3)`,
      [randomUUID(), reportId, action],
    );
    await client.query(
      "UPDATE flags SET resolved = true WHERE report_id = $1",
      [reportId],
    );
    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
