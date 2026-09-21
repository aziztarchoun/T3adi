import { Router } from "express";
import { z } from "zod";

const router = Router();
const cache = new Map<string, { expiresAt: number; results: SearchResult[] }>();
const CACHE_TTL_MS = 2 * 60 * 1000;

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  lang: z.enum(["ar", "fr", "en"]).default("fr"),
});

interface SearchResult {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number | null;
}

function normalizeQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanSearchName(value: string) {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const administrativeStart = parts.findIndex(
    (part, index) =>
      index > 0 &&
      (/^(معتمدية|ولاية|délégation|delegation|gouvernorat|governorate)(?:\s|$)/i.test(
        part,
      ) ||
        /^\d{4,5}$/.test(part) ||
        /^(تونس|tunisie|tunisia)$/i.test(part)),
  );

  return parts
    .slice(0, administrativeStart > 0 ? administrativeStart : parts.length)
    .join(", ");
}

function distanceKm(
  first: { lat: number; lng: number },
  second: { lat: number; lng: number },
) {
  const latDistance = (first.lat - second.lat) * 111;
  const lngDistance =
    (first.lng - second.lng) * 111 * Math.cos((first.lat * Math.PI) / 180);
  return Math.sqrt(latDistance ** 2 + lngDistance ** 2);
}

router.get("/", async (req, res) => {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "A search query of at least 2 characters is required" });
  }

  const { q, lat, lng, lang } = parsed.data;
  const normalizedQuery = normalizeQuery(q);
  const locationKey =
    lat !== undefined && lng !== undefined
      ? `${lat.toFixed(2)},${lng.toFixed(2)}`
      : "none";
  const cacheKey = `${normalizedQuery.toLowerCase()}|${locationKey}|${lang}`;
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ results: cached.results });
  }

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      limit: "10",
      countrycodes: "tn",
      addressdetails: "1",
      "accept-language": lang,
      q: normalizedQuery,
    });

    if (lat !== undefined && lng !== undefined) {
      params.set(
        "viewbox",
        `${lng - 0.45},${lat + 0.35},${lng + 0.45},${lat - 0.35}`,
      );
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "t3adi-search/0.1",
        },
      },
    );

    if (!response.ok) {
      return res.status(502).json({ error: "Search provider unavailable" });
    }

    const providerResults = (await response.json()) as Array<{
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
    }>;
    const origin = lat !== undefined && lng !== undefined ? { lat, lng } : null;
    const results = providerResults
      .map((result) => {
        const point = { lat: Number(result.lat), lng: Number(result.lon) };
        return {
          placeId: String(result.place_id),
          name: cleanSearchName(result.display_name),
          ...point,
          distanceKm: origin ? distanceKm(point, origin) : null,
        };
      })
      .sort((first, second) =>
        first.distanceKm !== null && second.distanceKm !== null
          ? first.distanceKm - second.distanceKm
          : 0,
      )
      .slice(0, 8);

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, results });
    return res.json({ results });
  } catch {
    return res.status(502).json({ error: "Search provider unavailable" });
  }
});

export default router;
