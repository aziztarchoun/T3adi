import { createHash } from "node:crypto";
import type { RequestHandler } from "express";

type RateEntry = {
  count: number;
  resetAt: number;
};

const entries = new Map<string, RateEntry>();

function setting(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function identity(rawIdentity: string) {
  return createHash("sha256").update(rawIdentity).digest("hex");
}

export const writeRateLimit: RequestHandler = (req, res, next) => {
  const windowMs = setting("RATE_LIMIT_WINDOW_MINUTES", 15) * 60_000;
  const maxWrites = setting("RATE_LIMIT_MAX_WRITES", 20);
  const now = Date.now();
  const deviceToken = req.get("x-device-token")?.trim();
  const identities = [
    { key: identity(`ip:${req.ip}`), max: maxWrites * 5 },
    ...(deviceToken
      ? [{ key: identity(`device:${deviceToken}`), max: maxWrites }]
      : []),
  ];
  const currentEntries = identities.map(({ key }) => ({
    key,
    current: entries.get(key),
  }));
  const limited = currentEntries.find(
    ({ current }, index) =>
      current &&
      current.resetAt > now &&
      current.count >= identities[index].max,
  );

  if (limited?.current) {
    res.setHeader(
      "Retry-After",
      Math.ceil((limited.current.resetAt - now) / 1000),
    );
    return res.status(429).json({ error: "Too many write requests" });
  }

  for (const { key } of identities) {
    const current = entries.get(key);
    if (!current || current.resetAt <= now) {
      entries.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      current.count += 1;
    }
  }
  return next();
};
