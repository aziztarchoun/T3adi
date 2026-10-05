import { Router, type Request } from "express";
import { z } from "zod";
import {
  castVoteSchema,
  createReportSchema,
  flagReportSchema,
  REPORT_SEVERITIES,
  REPORT_TYPES,
} from "@road-safety-map/shared";
import { writeRateLimit } from "../middleware/writeRateLimit.js";
import {
  castVote,
  createReport,
  flagReport,
  listReports,
} from "../services/reports.js";

const router = Router();
const boundsSchema = z.object({
  south: z.coerce.number().min(-90).max(90),
  west: z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
});
const filterSchema = z.object({
  type: z.enum(REPORT_TYPES).optional(),
  severity: z.enum(REPORT_SEVERITIES).optional(),
});

function deviceToken(req: Request) {
  return req.get("x-device-token")?.trim() || undefined;
}

router.get("/", async (req, res, next) => {
  try {
    const hasBounds = ["south", "west", "north", "east"].some(
      (key) => req.query[key] !== undefined,
    );
    const parsedBounds = hasBounds ? boundsSchema.safeParse(req.query) : null;
    if (parsedBounds && !parsedBounds.success) {
      return res.status(400).json({ error: "Invalid map bounds" });
    }
    const parsedFilters = filterSchema.safeParse(req.query);
    if (!parsedFilters.success) {
      return res.status(400).json({ error: "Invalid report filters" });
    }

    return res.json(await listReports(parsedBounds?.data, parsedFilters.data));
  } catch (error) {
    return next(error);
  }
});

router.post("/", writeRateLimit, async (req, res, next) => {
  const parsed = createReportSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid report payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const report = await createReport(parsed.data, deviceToken(req));
    return res.status(201).json(report);
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/confirmations", writeRateLimit, async (req, res, next) => {
  const parsed = castVoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid confirmation vote",
      details: parsed.error.flatten(),
    });
  }

  try {
    const report = await castVote(req.params.id, parsed.data, deviceToken(req));
    if (!report) return res.status(404).json({ error: "Report not found" });
    return res.json(report);
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/flags", writeRateLimit, async (req, res, next) => {
  const parsed = flagReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid report flag",
      details: parsed.error.flatten(),
    });
  }

  try {
    const flagged = await flagReport(
      req.params.id,
      parsed.data.reason,
      deviceToken(req),
    );
    if (!flagged) return res.status(404).json({ error: "Report not found" });
    return res.status(202).json({ status: "received" });
  } catch (error) {
    return next(error);
  }
});

export default router;
