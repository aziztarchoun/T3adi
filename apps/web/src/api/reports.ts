import type {
  CastVoteInput,
  CreateReportInput,
  FlagReportInput,
  OpenFlagDto,
  ReportDto,
} from "@road-safety-map/shared";
import type {
  ReportSeverity,
  ReportType,
  RouteRiskDto,
  RouteRiskRequest,
} from "@road-safety-map/shared";

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

export async function calculateRouteRisk(
  input: RouteRiskRequest,
): Promise<RouteRiskDto> {
  const query = new URLSearchParams(
    Object.entries(input).map(([key, value]) => [key, String(value)]),
  );
  const response = await fetch(`${API_BASE_URL}/api/routes/risk?${query}`, {
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "Unable to calculate route");
  }
  return response.json() as Promise<RouteRiskDto>;
}

export function googleMapsDirectionsUrl(input: RouteRiskRequest): string {
  const origin = `${input.originLat},${input.originLng}`;
  const destination = `${input.destinationLat},${input.destinationLng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
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

export function getPhotoFullUrl(photoUrl?: string | null): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
    return photoUrl;
  }
  return `${API_BASE_URL}${photoUrl}`;
}

export async function uploadReportPhoto(file: File): Promise<string> {
  const deviceToken = getDeviceToken();
  const formData = new FormData();
  formData.append("photo", file);

  const response = await fetch(`${API_BASE_URL}/api/reports/upload`, {
    method: "POST",
    headers: {
      ...(deviceToken ? { "X-Device-Token": deviceToken } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "Failed to upload photo");
  }

  const data = (await response.json()) as { photoUrl: string };
  return data.photoUrl;
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

// ---------------------------------------------------------------------------
// Moderation API (requires moderator token)
// ---------------------------------------------------------------------------

export async function fetchOpenFlags(token: string): Promise<OpenFlagDto[]> {
  const response = await fetch(`${API_BASE_URL}/api/moderation/flags`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 401) throw new Error("unauthorized");
  if (!response.ok) throw new Error("Failed to load flags");
  return response.json() as Promise<OpenFlagDto[]>;
}

export async function hideReport(id: string, token: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/moderation/reports/${id}/hide`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) throw new Error("Failed to hide report");
}

export async function unhideReport(id: string, token: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/moderation/reports/${id}/unhide`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) throw new Error("Failed to unhide report");
}

export async function dismissReportFlags(
  id: string,
  token: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/moderation/reports/${id}/dismiss`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) throw new Error("Failed to dismiss flags");
}
