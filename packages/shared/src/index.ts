import { z } from "zod";

/**
 * Types shared between apps/web and apps/api so the frontend and backend
 * never drift out of sync on the shape of a report.
 *
 * See docs/PROJECT_PLAN.md for the full rationale behind these values.
 */

export const REPORT_TYPES = [
  "flooding",
  "pothole",
  "blocked",
  "accident_obstacle",
  "other",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_SEVERITIES = [
  "safe",
  "caution",
  "dangerous",
  "blocked",
] as const;
export type ReportSeverity = (typeof REPORT_SEVERITIES)[number];

export const REPORT_STATUSES = [
  "active",
  "resolved",
  "expired",
  "hidden",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const CONFIRMATION_VOTES = ["confirm", "dispute", "resolved"] as const;
export type ConfirmationVote = (typeof CONFIRMATION_VOTES)[number];

/** Request body for POST /api/reports */
export const createReportSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  type: z.enum(REPORT_TYPES),
  severity: z.enum(REPORT_SEVERITIES),
  description: z.string().max(200).optional(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

/** Request body for POST /api/reports/:id/confirmations */
export const castVoteSchema = z.object({
  vote: z.enum(CONFIRMATION_VOTES),
});
export type CastVoteInput = z.infer<typeof castVoteSchema>;

/** A report as returned by the API, including computed display fields. */
export interface ReportDto {
  id: string;
  lat: number;
  lng: number;
  type: ReportType;
  severity: ReportSeverity;
  description: string | null;
  status: ReportStatus;
  createdAt: string;
  lastConfirmedAt: string | null;
  confirmationCount: number;
  disputeCount: number;
  /** 0-100, see docs/PROJECT_PLAN.md Phase 6 */
  confidence: number;
  /** Human-readable summary, e.g. "3 confirmations, last confirmed 4 minutes ago" */
  freshnessSummary: string;
}
