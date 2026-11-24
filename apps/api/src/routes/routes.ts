import { Router } from "express";
import { routeRiskRequestSchema } from "@road-safety-map/shared";
import { calculateRouteRisk } from "../services/routes.js";

const router = Router();

router.get("/risk", async (req, res, next) => {
  const parsed = routeRiskRequestSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid route coordinates" });
  }

  try {
    return res.json(await calculateRouteRisk(parsed.data));
  } catch (error) {
    return next(error);
  }
});

export default router;
