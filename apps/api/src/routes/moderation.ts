import { Router } from "express";
import { requireModerator } from "../middleware/moderatorAuth.js";
import { listOpenFlags, setReportVisibility } from "../services/moderation.js";

const router = Router();
router.use(requireModerator);

router.get("/flags", async (_req, res, next) => {
  try {
    return res.json(await listOpenFlags());
  } catch (error) {
    return next(error);
  }
});

router.post("/reports/:id/hide", async (req, res, next) => {
  try {
    const report = await setReportVisibility(req.params.id, "hidden", "hide");
    if (!report) return res.status(404).json({ error: "Report not found" });
    return res.json(report);
  } catch (error) {
    return next(error);
  }
});

router.post("/reports/:id/unhide", async (req, res, next) => {
  try {
    const report = await setReportVisibility(req.params.id, "active", "unhide");
    if (!report) return res.status(404).json({ error: "Report not found" });
    return res.json(report);
  } catch (error) {
    return next(error);
  }
});

export default router;
