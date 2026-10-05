import type {
  CastVoteInput,
  CreateReportInput,
  FlagReportInput,
  ReportDto,
} from "@road-safety-map/shared";
import type { ReportSeverity, ReportType } from "@road-safety-map/shared";

const CONFIGURED_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const API_BASE_URL = import.meta.env.DEV ? "" : CONFIGURED_API_BASE_URL;
const DEVICE_TOKEN_KEY = "t3adi-device-token";

export interface ReportBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface ReportFilters {
  type?: ReportType;
  severity?: ReportSeverity;
}

function getDeviceToken() {
  try {
    const storedToken = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (storedToken) return storedToken;

    const token = crypto.randomUUID();
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
    return token;
  } catch {
    return undefined;
  }
}

if (!CONFIGURED_API_BASE_URL && import.meta.env.PROD) {
  // In production (e.g. GitHub Pages) there is no server behind this
  // domain, so a relative /api/... path 404s. This warning exists so the
  // failure is obvious in devtools instead of silently returning 404s.
  console.warn(
    "VITE_API_BASE_URL is not set — API requests will 404 on a static host. See README.md.",
  );
}

export async function fetchReports(
  bounds?: ReportBounds | null,
  filters: ReportFilters = {},
): Promise<ReportDto[]> {
  const query = new URLSearchParams();
  if (bounds) {
    query.set("south", String(bounds.south));
    query.set("west", String(bounds.west));
    query.set("north", String(bounds.north));
    query.set("east", String(bounds.east));
  }
  if (filters.type) query.set("type", filters.type);
  if (filters.severity) query.set("severity", filters.severity);
  const params = query.toString() ? `?${query}` : "";
  const response = await fetch(`${API_BASE_URL}/api/reports${params}`, {
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error("Failed to load reports");
  }

  return response.json() as Promise<ReportDto[]>;
}

export async function createReport(
  input: CreateReportInput,
): Promise<ReportDto> {
  const deviceToken = getDeviceToken();
  const response = await fetch(`${API_BASE_URL}/api/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(deviceToken ? { "X-Device-Token": deviceToken } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "Failed to create report");
  }

  return response.json() as Promise<ReportDto>;
}

export async function castReportVote(
  reportId: string,
  input: CastVoteInput,
): Promise<ReportDto> {
  const deviceToken = getDeviceToken();
  const response = await fetch(
    `${API_BASE_URL}/api/reports/${reportId}/confirmations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(deviceToken ? { "X-Device-Token": deviceToken } : {}),
      },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "Failed to submit vote");
  }

  return response.json() as Promise<ReportDto>;
}

export async function flagReport(
  reportId: string,
  input: FlagReportInput,
): Promise<void> {
  const deviceToken = getDeviceToken();
  const response = await fetch(
    `${API_BASE_URL}/api/reports/${reportId}/flags`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(deviceToken ? { "X-Device-Token": deviceToken } : {}),
      },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "Failed to flag report");
  }
}
