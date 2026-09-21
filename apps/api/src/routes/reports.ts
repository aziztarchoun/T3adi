import { randomUUID } from "node:crypto";
import { Router } from "express";
import {
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

export default router;
