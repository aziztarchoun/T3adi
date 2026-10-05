export interface MapCoordinates {
  lat: number;
  lng: number;
}

const COORDINATE_PATTERN =
  /(-?(?:\d{1,3}(?:\.\d+)?)),\s*(-?(?:\d{1,3}(?:\.\d+)?))/;

function validCoordinates(lat: number, lng: number): MapCoordinates | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function parseGoogleMapsCoordinates(
  value: string,
): MapCoordinates | null {
  const input = value.trim();
  if (!input) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  const isGoogleMapsHost =
    hostname === "maps.google.com" ||
    hostname === "www.google.com" ||
    hostname === "google.com";
  const isMapsPath = url.pathname.toLowerCase().startsWith("/maps");
  if (!isGoogleMapsHost || (hostname !== "maps.google.com" && !isMapsPath)) {
    return null;
  }

  const candidates = [
    url.searchParams.get("q"),
    url.searchParams.get("query"),
    url.searchParams.get("ll"),
    url.pathname,
    url.hash,
  ].filter((candidate): candidate is string => Boolean(candidate));

  const atMatch = url.pathname.match(/@(-?[\d.]+),\s*(-?[\d.]+)/);
  if (atMatch) candidates.unshift(`${atMatch[1]},${atMatch[2]}`);

  for (const candidate of candidates) {
    const match = candidate.match(COORDINATE_PATTERN);
    if (!match) continue;
    const coordinates = validCoordinates(Number(match[1]), Number(match[2]));
    if (coordinates) return coordinates;
  }

  return null;
}
