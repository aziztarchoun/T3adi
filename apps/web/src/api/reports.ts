import type { CreateReportInput, ReportDto } from "@road-safety-map/shared";

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_API_BASE_URL ?? "";

export async function fetchReports(): Promise<ReportDto[]> {
  const response = await fetch(`${API_BASE_URL}/api/reports`);

  if (!response.ok) {
    throw new Error("Failed to load reports");
  }

  return response.json() as Promise<ReportDto[]>;
}

export async function createReport(
  input: CreateReportInput,
): Promise<ReportDto> {
  const response = await fetch(`${API_BASE_URL}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "Failed to create report");
  }

  return response.json() as Promise<ReportDto>;
}
