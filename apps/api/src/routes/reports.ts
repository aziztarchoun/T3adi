import { randomUUID } from "node:crypto";
import { Router } from "express";
import {
  castVoteSchema,
  createReportSchema,
  type ReportDto,
  type ReportType,
} from "@road-safety-map/shared";

const reports: ReportDto[] = [
  {
    id: "sample-flooding-1",
    lat: 36.8065,
    lng: 10.1815,
    type: "flooding",
    severity: "dangerous",
    description: "Water pooling on the road after heavy rain.",
    status: "active",
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    lastConfirmedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    confirmationCount: 3,
    disputeCount: 0,
    confidence: 84,
    freshnessSummary: "Confirmed 5 minutes ago",
  },
  {
    id: "sample-pothole-1",
    lat: 36.82,
    lng: 10.17,
    type: "pothole",
    severity: "caution",
    description: "Large pothole near the bus stop.",
    status: "active",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    lastConfirmedAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
    confirmationCount: 2,
    disputeCount: 1,
    confidence: 58,
    freshnessSummary: "Last confirmed 28 minutes ago",
  },
];

const router = Router();

function refreshReportConfidence(report: ReportDto) {
  const totalVotes = report.confirmationCount + report.disputeCount;
  report.confidence = totalVotes
    ? Math.round((report.confirmationCount / totalVotes) * 100)
    : 0;

  if (report.status !== "resolved") {
    report.status = report.confidence < 15 ? "expired" : "active";
  }
}

router.get("/", (_req, res) => {
  res.json(reports);
});

router.post("/", (req, res) => {
  const parsed = createReportSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid report payload",
      details: parsed.error.flatten(),
    });
  }

  const payload = parsed.data;
  const now = new Date().toISOString();
  const report: ReportDto = {
    id: randomUUID(),
    lat: payload.lat,
    lng: payload.lng,
    type: payload.type as ReportType,
    severity: payload.severity,
    description: payload.description ?? null,
    status: "active",
    createdAt: now,
    lastConfirmedAt: now,
    confirmationCount: 1,
    disputeCount: 0,
    confidence: 100,
    freshnessSummary: "Just reported",
  };

  reports.unshift(report);
  return res.status(201).json(report);
});

router.post("/:id/confirmations", (req, res) => {
  const parsed = castVoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid confirmation vote",
      details: parsed.error.flatten(),
    });
  }

  const report = reports.find((candidate) => candidate.id === req.params.id);
  if (!report) {
    return res.status(404).json({ error: "Report not found" });
  }

  const now = new Date().toISOString();
  if (parsed.data.vote === "confirm") {
    report.confirmationCount += 1;
    report.lastConfirmedAt = now;
    report.freshnessSummary = "Confirmed just now";
  } else if (parsed.data.vote === "dispute") {
    report.disputeCount += 1;
    report.freshnessSummary = "Disputed just now";
  } else {
    report.status = "resolved";
    report.lastConfirmedAt = now;
    report.freshnessSummary = "Marked clear just now";
  }

  refreshReportConfidence(report);
  return res.json(report);
});

export default router;
