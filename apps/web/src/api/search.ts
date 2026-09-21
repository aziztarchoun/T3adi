import type { Language } from "../i18n";

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_API_BASE_URL ?? "";

export interface SearchSuggestion {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number | null;
}

export async function searchPlaces(
  query: string,
  location?: { lat: number; lng: number } | null,
  language: Language = "ar",
  signal?: AbortSignal,
): Promise<SearchSuggestion[]> {
  const params = new URLSearchParams({ q: query, lang: language });
  if (location) {
    params.set("lat", String(location.lat));
    params.set("lng", String(location.lng));
  }

  const response = await fetch(
    `${API_BASE_URL}/api/search?${params.toString()}`,
    {
      signal,
    },
  );
  if (!response.ok) throw new Error("Search unavailable");

  const body = (await response.json()) as { results: SearchSuggestion[] };
  return body.results;
}
