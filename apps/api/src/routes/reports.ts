import { Router, type Request } from "express";
import { z } from "zod";
import {
  castVoteSchema,
  createReportSchema,
  flagReportSchema,
  REPORT_SEVERITIES,
  REPORT_TYPES,
} from "@road-safety-map/shared";
import { photoUpload } from "../middleware/upload.js";
import { writeRateLimit } from "../middleware/writeRateLimit.js";
import {
  castVote,
  createReport,
  flagReport,
  listReports,
} from "../services/reports.js";

const router = Router();
const boundsSchema = z
  .object({
    south: z.coerce.number().min(-90).max(90),
    west: z.coerce.number().min(-180).max(180),
    north: z.coerce.number().min(-90).max(90),
    east: z.coerce.number().min(-180).max(180),
  })
  .refine((bounds) => bounds.south <= bounds.north, {
    message: "south must be less than or equal to north",
  })
  .refine((bounds) => bounds.west <= bounds.east, {
    message: "west must be less than or equal to east",
  });
const filterSchema = z.object({
  type: z.enum(REPORT_TYPES).optional(),
  severity: z.enum(REPORT_SEVERITIES).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
const reportIdSchema = z.string().uuid();
const deviceTokenSchema = z.string().trim().min(1).max(128);

function deviceToken(req: Request): string | undefined {
  const value = req.get("x-device-token");
  if (!value) return undefined;
  const parsed = deviceTokenSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
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

router.post("/upload", writeRateLimit, (req, res) => {
  photoUpload.single("photo")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No photo file provided" });
    }
    return res.status(201).json({
      photoUrl: `/uploads/${req.file.filename}`,
    });
  });
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
  const parsedId = reportIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ error: "Invalid report ID" });
  }
  const parsed = castVoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid confirmation vote",
      details: parsed.error.flatten(),
    });
  }

  try {
    const report = await castVote(parsedId.data, parsed.data, deviceToken(req));
    if (!report) return res.status(404).json({ error: "Report not found" });
    return res.json(report);
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/flags", writeRateLimit, async (req, res, next) => {
  const parsedId = reportIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ error: "Invalid report ID" });
  }
  const parsed = flagReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid report flag",
      details: parsed.error.flatten(),
    });
  }

  try {
    const flagged = await flagReport(
      parsedId.data,
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
