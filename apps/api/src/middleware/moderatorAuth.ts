import type { RequestHandler } from "express";

export const requireModerator: RequestHandler = (req, res, next) => {
  const configuredToken = process.env.MODERATOR_TOKEN?.trim();
  if (!configuredToken) {
    return res
      .status(503)
      .json({ error: "Moderator access is not configured" });
  }

  const authorization = req.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token || token !== configuredToken) {
    return res.status(401).json({ error: "Moderator authentication required" });
  }

  return next();
};
