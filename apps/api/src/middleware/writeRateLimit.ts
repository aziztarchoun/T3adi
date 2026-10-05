import { createHash } from "node:crypto";
import type { Request, RequestHandler } from "express";

type RateEntry = {
  count: number;
  resetAt: number;
};

const entries = new Map<string, RateEntry>();

function setting(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function identity(req: Request) {
  const deviceToken = req.get("x-device-token")?.trim() ?? "anonymous";
  const rawIdentity = `${req.ip}:${deviceToken}`;
  return createHash("sha256").update(rawIdentity).digest("hex");
}

export const writeRateLimit: RequestHandler = (req, res, next) => {
  const windowMs = setting("RATE_LIMIT_WINDOW_MINUTES", 15) * 60_000;
  const maxWrites = setting("RATE_LIMIT_MAX_WRITES", 20);
  const now = Date.now();
  const key = identity(req);
  const current = entries.get(key);

  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (current.count >= maxWrites) {
    res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
    return res.status(429).json({ error: "Too many write requests" });
  }

  current.count += 1;
  return next();
};
