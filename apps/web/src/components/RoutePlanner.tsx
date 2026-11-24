import { useEffect, useState } from "react";
import type { RouteRiskDto, RouteRiskRequest } from "@road-safety-map/shared";
import { calculateRouteRisk, googleMapsDirectionsUrl } from "../api/reports";
import type { Language, Translation } from "../i18n";
import { searchPlaces, type SearchSuggestion } from "../api/search";

interface RoutePlannerProps {
  language: Language;
  copy: Translation;
  userLocation: { lat: number; lng: number } | null;
  onRoute: (route: RouteRiskDto | null) => void;
  destinationRequest: SearchSuggestion | null;
  onDestinationRequestHandled: () => void;
  onHazardSelect: (report: RouteRiskDto["hazards"][number]["report"]) => void;
}

export default function RoutePlanner({
  language,
  copy,
  userLocation,
  onRoute,
  destinationRequest,
  onDestinationRequestHandled,
  onHazardSelect,
}: RoutePlannerProps) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [selectedDestination, setSelectedDestination] =
    useState<SearchSuggestion | null>(null);
  const [searching, setSearching] = useState(false);
  const [request, setRequest] = useState<RouteRiskRequest | null>(null);
  const [route, setRoute] = useState<RouteRiskDto | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [routeResultExpanded, setRouteResultExpanded] = useState(true);

  const riskLabels = {
    low: copy.routeRiskLow,
    moderate: copy.routeRiskModerate,
    high: copy.routeRiskHigh,
  };

  useEffect(() => {
    const query = destination.trim();
    if (query.length < 2 || selectedDestination?.name === query) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        setSuggestions(
          await searchPlaces(query, userLocation, language, controller.signal),
        );
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [destination, language, selectedDestination, userLocation]);

  async function runRoute(
    nextDestination: SearchSuggestion | null,
    destinationText: string,
  ) {
    if (!userLocation) {
      setError(true);
      return;
    }
    const [lat, lng] = nextDestination
      ? [nextDestination.lat, nextDestination.lng]
      : destinationText.split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError(true);
      return;
    }
    const nextRequest = {
      originLat: userLocation.lat,
      originLng: userLocation.lng,
      destinationLat: lat,
      destinationLng: lng,
    };
    setLoading(true);
    setError(false);
    try {
      const nextRoute = await calculateRouteRisk(nextRequest);
      setRequest(nextRequest);
      setRoute(nextRoute);
      setRouteResultExpanded(true);
      onRoute(nextRoute);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!destinationRequest) return;
    setDestination(destinationRequest.name);
    setSelectedDestination(destinationRequest);
    setOpen(true);
    void runRoute(destinationRequest, destinationRequest.name);
    onDestinationRequestHandled();
  }, [destinationRequest, onDestinationRequestHandled]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await runRoute(selectedDestination, destination);
  }

  return (
    <div
      className={`route-planner-shell absolute left-4 right-4 top-[9.15rem] z-[1150] mx-auto flex max-w-md flex-col items-end ${
        open ? "route-planner-open" : ""
      } ${route ? "route-planner-has-result" : ""}`}
    >
      {open && (
        <form
          id="route-planner-form"
          onSubmit={submit}
          className="route-planner-panel mt-2 rounded-[24px] bg-white/95 p-3 shadow-xl ring-1 ring-slate-200"
        >
          <div className="route-planner-handle" aria-hidden="true" />
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-900">
              {copy.routePlanner}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={copy.close}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-lg text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#03ab82]"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
          <label
            className="block text-xs font-bold text-slate-600"
            htmlFor="route-destination"
          >
            {copy.routeDestination}
          </label>
          <div className="relative">
            <input
              id="route-destination"
              value={destination}
              onChange={(event) => {
                setDestination(event.target.value);
                setSelectedDestination(null);
                setError(false);
              }}
              placeholder={copy.routeDestinationPlaceholder}
              autoComplete="off"
              className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none focus:border-[#03ab82] focus:ring-2 focus:ring-[#03ab82]/20"
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-controls="route-destination-suggestions"
            />
            {(searching || suggestions.length > 0) && (
              <div
                id="route-destination-suggestions"
                role="listbox"
                className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              >
                {searching && (
                  <p className="px-3 py-2 text-xs text-slate-500">
                    {copy.searching}
                  </p>
                )}
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.placeId}
                    type="button"
                    role="option"
                    onClick={() => {
                      setSelectedDestination(suggestion);
                      setDestination(suggestion.name);
                      setSuggestions([]);
                      setError(false);
                    }}
                    className="block min-h-11 w-full border-t border-slate-100 px-3 py-2 text-start text-sm text-slate-800 hover:bg-slate-50"
                  >
                    {suggestion.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">{copy.routeHint}</p>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 min-h-12 w-full rounded-2xl bg-[#03ab82] px-3 text-sm font-bold text-white shadow-[0_4px_12px_rgba(3,171,130,0.22)] transition hover:bg-[#087f68] disabled:opacity-60"
          >
            {loading ? copy.routeLoading : copy.routeCheck}
          </button>
          {error && (
            <p className="mt-2 text-sm text-red-700">{copy.routeError}</p>
          )}
          {route && request && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-bold">
                {copy.routeRisk}: {route.riskScore}/100 (
                {riskLabels[route.riskLabel]})
              </p>
              <button
                type="button"
                aria-expanded={routeResultExpanded}
                onClick={() => setRouteResultExpanded((value) => !value)}
                className="mt-2 text-xs font-semibold text-slate-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                {routeResultExpanded ? copy.close : copy.routeRisk}
              </button>
              {routeResultExpanded && (
                <>
                  {route.hazards.length > 0 ? (
                    <p className="mt-1 text-slate-600">
                      {route.riskLabel === "low"
                        ? copy.routeAdvisoryLow
                        : copy.routeAdvisoryHazards}
                    </p>
                  ) : (
                    <p className="mt-1 font-semibold text-emerald-700">
                      {copy.routeNoHazards}
                    </p>
                  )}
                  {route.hazards.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {route.hazards.map((hazard) => (
                        <li key={hazard.report.id}>
                          <button
                            type="button"
                            onClick={() => onHazardSelect(hazard.report)}
                            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-start transition hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                          >
                            <span className="font-semibold text-slate-900">
                              {copy.type[hazard.report.type]} ·{" "}
                              {copy.severityLabel[hazard.report.severity]}
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-600">
                              {copy.routeHazardDistance}:{" "}
                              {Math.round(hazard.distanceMeters)} m ·{" "}
                              {copy.routeHazardAge}:{" "}
                              {new Intl.DateTimeFormat(language, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }).format(new Date(hazard.report.createdAt))}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    aria-expanded={explanationOpen}
                    onClick={() => setExplanationOpen((value) => !value)}
                    className="mt-3 text-start text-xs font-semibold text-slate-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  >
                    {copy.routeScoreHelp}
                  </button>
                  {explanationOpen && (
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {copy.routeScoreHelpText}
                    </p>
                  )}
                </>
              )}
              <a
                className="mt-2 inline-block font-bold text-slate-900 underline"
                href={googleMapsDirectionsUrl(request)}
                target="_blank"
                rel="noreferrer"
              >
                {copy.openGoogleMaps}
              </a>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
