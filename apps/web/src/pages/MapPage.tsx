import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  REPORT_SEVERITIES,
  REPORT_TYPES,
  type ConfirmationVote,
  type ReportDto,
  type ReportSeverity,
  type ReportType,
  type RouteRiskDto,
} from "@road-safety-map/shared";
import {
  castReportVote,
  createReport,
  flagReport,
  getPhotoFullUrl,
} from "../api/reports";
import type { ReportBounds } from "../api/reports";
import { searchPlaces, type SearchSuggestion } from "../api/search";
import MapView from "../components/MapView";
import MapHeader from "../components/MapHeader";
import ReportForm from "../components/ReportForm";
import Sidebar from "../components/Sidebar";
import RoutePlanner from "../components/RoutePlanner";
import { useReports } from "../hooks/useReports";
import { translations, type Language } from "../i18n";
import { parseGoogleMapsCoordinates } from "../utils/googleMaps";
import { enqueueReport, registerOnlineFlush } from "../utils/offlineQueue";
import ModerationPage from "./ModerationPage";

const DEFAULT_LOCATION = { lat: 36.8065, lng: 10.1815 };
const TUNISIA_BOUNDS = {
  minLat: 30.0,
  maxLat: 37.6,
  minLng: 7.5,
  maxLng: 11.6,
};

function isWithinTunisia(lat: number, lng: number): boolean {
  return (
    lat >= TUNISIA_BOUNDS.minLat &&
    lat <= TUNISIA_BOUNDS.maxLat &&
    lng >= TUNISIA_BOUNDS.minLng &&
    lng <= TUNISIA_BOUNDS.maxLng
  );
}
const WEB_BASE_URL =
  (
    import.meta as ImportMeta & {
      env?: Record<string, string | undefined>;
    }
  ).env?.BASE_URL ?? "/";
const IS_DEVELOPMENT = Boolean(
  (
    import.meta as ImportMeta & {
      env?: { DEV?: boolean };
    }
  ).env?.DEV,
);
const SAVED_LOCATION_KEY = "t3adi-user-location";

function formatReportAge(
  createdAt: string,
  lastConfirmedAt: string | null,
  language: Language,
  fallback: string,
) {
  const timestamp = lastConfirmedAt ?? createdAt;
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(timestamp).getTime()) / 60_000),
  );
  if (!Number.isFinite(elapsedMinutes)) return fallback;
  const unit =
    elapsedMinutes < 60
      ? { value: -elapsedMinutes, unit: "minute" as const }
      : { value: -Math.floor(elapsedMinutes / 60), unit: "hour" as const };
  return new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(
    unit.value,
    unit.unit,
  );
}

function hasSavedLocation() {
  if (IS_DEVELOPMENT) return false;

  try {
    const savedLocation = localStorage.getItem(SAVED_LOCATION_KEY);
    if (!savedLocation) return false;
    const parsed = JSON.parse(savedLocation) as {
      lat?: unknown;
      lng?: unknown;
    };
    return typeof parsed.lat === "number" && typeof parsed.lng === "number";
  } catch {
    return false;
  }
}

function BottomSheet({
  children,
  onClose,
  label,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
}) {
  const startY = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", handleTab);
    return () => dialog.removeEventListener("keydown", handleTab);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/20 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
      onClick={onClose}
      onTouchStart={(event) => {
        startY.current = event.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(event) => {
        const endY = event.changedTouches[0]?.clientY;
        if (
          startY.current !== null &&
          endY !== undefined &&
          endY - startY.current > 80
        ) {
          onClose();
        }
        startY.current = null;
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="w-full max-h-[calc(100dvh-1.5rem)] max-w-md overflow-y-auto rounded-[28px] bg-white shadow-[0_-8px_30px_rgba(15,23,42,0.22)] transition-transform duration-200"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => {
          startY.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          const endY = event.changedTouches[0]?.clientY;
          if (
            startY.current !== null &&
            endY !== undefined &&
            endY - startY.current > 80
          ) {
            onClose();
          }
          startY.current = null;
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function MapPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [locationPromptOpen, setLocationPromptOpen] = useState(
    () => !hasSavedLocation(),
  );
  const [locationRequesting, setLocationRequesting] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [reportFormOpen, setReportFormOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportDto | null>(null);
  const [selectedVote, setSelectedVote] = useState<ConfirmationVote | null>(
    null,
  );
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("fr");
  const [actionMessage, setActionMessage] = useState<
    "success" | "error" | "flag-success" | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLocation, setSearchLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<
    SearchSuggestion[]
  >([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionRefreshToken, setSuggestionRefreshToken] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [selectionPulse, setSelectionPulse] = useState(0);
  const [reportButtonJumping, setReportButtonJumping] = useState(false);
  const [draftLocation, setDraftLocation] = useState(DEFAULT_LOCATION);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [route, setRoute] = useState<RouteRiskDto | null>(null);
  const [routeDestinationRequest, setRouteDestinationRequest] =
    useState<SearchSuggestion | null>(null);
  const [reportBounds, setReportBounds] = useState<ReportBounds | null>(null);
  const [reportTypeFilter, setReportTypeFilter] = useState<ReportType | "all">(
    "all",
  );
  const [reportSeverityFilter, setReportSeverityFilter] = useState<
    ReportSeverity | "all"
  >("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [offlineToast, setOfflineToast] = useState<"queued" | "flushed" | null>(
    null,
  );
  const skipSuggestionFetchRef = useRef(false);
  const queryClient = useQueryClient();
  const {
    data: reports = [],
    isLoading,
    isError,
  } = useReports(reportBounds, {
    ...(reportTypeFilter === "all" ? {} : { type: reportTypeFilter }),
    ...(reportSeverityFilter === "all"
      ? {}
      : { severity: reportSeverityFilter }),
  });
  const copy = translations[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  // Register the online-reconnect flush for queued offline reports
  useEffect(() => {
    const cleanup = registerOnlineFlush((count) => {
      void count; // used only to trigger toast
      setOfflineToast("flushed");
      setTimeout(() => setOfflineToast(null), 4000);
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    }, createReport);
    return cleanup;
  }, [queryClient]);

  useEffect(() => {
    if (skipSuggestionFetchRef.current) {
      skipSuggestionFetchRef.current = false;
      setSearchSuggestions([]);
      setIsSuggesting(false);
      return;
    }

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchSuggestions([]);
      setIsSuggesting(false);
      return;
    }

    if (parseGoogleMapsCoordinates(query)) {
      setSearchSuggestions([]);
      setIsSuggesting(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSuggesting(true);

      try {
        const suggestions = await searchPlaces(
          query,
          userLocation,
          language,
          controller.signal,
        );
        if (!controller.signal.aborted) setSearchSuggestions(suggestions);
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") {
          setSearchSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsSuggesting(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [language, searchQuery, suggestionRefreshToken, userLocation]);

  useEffect(() => {
    if (!reportFormOpen && !selectedReport) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setReportFormOpen(false);
      setSelectedReport(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [reportFormOpen, selectedReport]);

  useEffect(() => {
    if (!locationPromptOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLocationPromptOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [locationPromptOpen]);

  useEffect(() => {
    if (IS_DEVELOPMENT) return;

    try {
      const savedLocation = localStorage.getItem(SAVED_LOCATION_KEY);
      if (!savedLocation) return;

      const parsed = JSON.parse(savedLocation) as {
        lat?: unknown;
        lng?: unknown;
      };
      if (typeof parsed.lat !== "number" || typeof parsed.lng !== "number") {
        return;
      }

      const location = { lat: parsed.lat, lng: parsed.lng };
      setUserLocation(location);
      setDraftLocation(location);
      setLocationPromptOpen(false);
    } catch {
      localStorage.removeItem(SAVED_LOCATION_KEY);
    }
  }, []);

  const createReportMutation = useMutation({
    mutationFn: async (input: Parameters<typeof createReport>[0]) => {
      if (!navigator.onLine) {
        enqueueReport(input);
        setOfflineToast("queued");
        setTimeout(() => setOfflineToast(null), 4000);
        return null;
      }
      return createReport(input);
    },
    onSuccess: (result) => {
      if (result === null) {
        // Offline-queued — close form silently
        setReportFormOpen(false);
        setSelectedReport(null);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setReportFormOpen(false);
      setSelectedReport(null);
      setActionMessage("success");
    },
    onError: () => setActionMessage("error"),
  });

  const voteMutation = useMutation({
    mutationFn: ({
      reportId,
      vote,
    }: {
      reportId: string;
      vote: ConfirmationVote;
    }) => castReportVote(reportId, { vote }),
    onSuccess: (updatedReport, variables) => {
      setSelectedReport(updatedReport);
      setSelectedVote(variables.vote);
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setActionMessage("success");
    },
    onError: () => setActionMessage("error"),
  });

  const flagMutation = useMutation({
    mutationFn: (reportId: string) =>
      flagReport(reportId, { reason: "inaccurate" }),
    onSuccess: () => setActionMessage("flag-success"),
    onError: () => setActionMessage("error"),
  });

  const handleReportButtonClick = () => {
    setSelectedReport(null);
    setActionMessage(null);
    setReportFormOpen(true);
  };

  function handleSelectTestLocation(loc: { lat: number; lng: number }) {
    setUserLocation(loc);
    setDraftLocation(loc);
    setLocationNotice(null);
    setLocationPromptOpen(false);
  }

  function handleAllowLocation() {
    if (!navigator.geolocation) {
      setLocationPromptOpen(false);
      setLocationNotice(copy.loadError);
      return;
    }

    if (
      window.isSecureContext === false &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setLocationPromptOpen(false);
      setLocationNotice(copy.safariLocationHint);
      handleSelectTestLocation(DEFAULT_LOCATION);
      return;
    }

    setLocationRequesting(true);

    const onLocationSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      const insideTunisia = isWithinTunisia(latitude, longitude);

      if (insideTunisia) {
        const nextLocation = { lat: latitude, lng: longitude };
        setUserLocation(nextLocation);
        setDraftLocation(nextLocation);
        setLocationNotice(null);
        if (!IS_DEVELOPMENT) {
          try {
            localStorage.setItem(
              SAVED_LOCATION_KEY,
              JSON.stringify(nextLocation),
            );
          } catch {
            // ignore
          }
        }
      } else {
        // Outside Tunisia (e.g. Malaysia IP geolocation glitch)
        // Keep user in Tunis so map and reports are valid!
        setUserLocation(DEFAULT_LOCATION);
        setDraftLocation(DEFAULT_LOCATION);
        setLocationNotice(copy.locationOutsideTunisia);
      }

      setLocationRequesting(false);
      setLocationPromptOpen(false);
    };

    const onLocationFailure = (error: GeolocationPositionError) => {
      setLocationRequesting(false);
      setLocationPromptOpen(false);
      setUserLocation(DEFAULT_LOCATION);
      setDraftLocation(DEFAULT_LOCATION);

      if (error.code === error.PERMISSION_DENIED) {
        setLocationNotice(copy.safariLocationHint);
      } else {
        setLocationNotice(copy.loadError);
      }
    };

    // Safari dual-attempt: First try high accuracy with 5s timeout.
    // If it fails with TIMEOUT or POSITION_UNAVAILABLE (Safari CoreLocation delay),
    // immediately retry with enableHighAccuracy: false and 12s timeout.
    navigator.geolocation.getCurrentPosition(
      onLocationSuccess,
      (firstError) => {
        if (
          firstError.code === firstError.TIMEOUT ||
          firstError.code === firstError.POSITION_UNAVAILABLE
        ) {
          navigator.geolocation.getCurrentPosition(
            onLocationSuccess,
            onLocationFailure,
            { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
          );
        } else {
          onLocationFailure(firstError);
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 },
    );
  }

  const handleMapSelection = (location: { lat: number; lng: number }) => {
    setSearchSuggestions([]);
    setActiveSuggestionIndex(-1);
    setIsSuggesting(false);
    setDraftLocation(location);
    setSelectionPulse((current) => current + 1);
    setReportButtonJumping(true);
    window.setTimeout(() => setReportButtonJumping(false), 520);
  };

  const handleSuggestionSelect = (suggestion: {
    name: string;
    lat: number;
    lng: number;
  }) => {
    const location = { lat: suggestion.lat, lng: suggestion.lng };
    skipSuggestionFetchRef.current = true;
    setSearchQuery(suggestion.name);
    setSearchSuggestions([]);
    setActiveSuggestionIndex(-1);
    setSearchError(false);
    setDraftLocation(location);
    setSearchLocation(location);
    setSelectionPulse((current) => current + 1);
    setReportButtonJumping(true);
    window.setTimeout(() => setReportButtonJumping(false), 520);
  };

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setSearchSuggestions([]);
    setActiveSuggestionIndex(-1);
    setIsSearching(true);
    setSearchError(false);

    const googleMapsLocation = parseGoogleMapsCoordinates(query);
    if (googleMapsLocation) {
      setDraftLocation(googleMapsLocation);
      setSearchLocation(googleMapsLocation);
      setSelectionPulse((current) => current + 1);
      setIsSearching(false);
      return;
    }

    try {
      const results = await searchPlaces(query, userLocation, language);
      const result = results[0];

      if (!result) {
        setSearchError(true);
        return;
      }

      const location = { lat: result.lat, lng: result.lng };
      setDraftLocation(location);
      setSearchLocation(location);
      setSelectionPulse((current) => current + 1);
    } catch {
      setSearchError(true);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <>
      <div
        dir={language === "ar" ? "rtl" : "ltr"}
        className="app-shell relative w-screen overflow-hidden bg-slate-100"
      >
        <MapHeader
          language={language}
          onLanguageChange={setLanguage}
          onMenuOpen={() => setSidebarOpen(true)}
          logoSrc={`${WEB_BASE_URL}assets/logo%20white.svg`}
          disclaimer={copy.disclaimer}
          menuLabel={copy.menu}
          languageLabel={copy.chooseLanguage}
          appName={copy.appName}
        />

        <MapView
          reports={reports}
          userLocation={userLocation}
          draftLocation={draftLocation}
          searchLocation={searchLocation}
          selectionPulse={selectionPulse}
          onDraftLocationChange={setDraftLocation}
          onMapClick={handleMapSelection}
          onReportSelect={(report) => {
            setSelectedReport(report);
            setSelectedVote(null);
          }}
          onBoundsChange={setReportBounds}
          route={route}
          mapLabels={{
            mapControls: copy.mapControls,
            zoomIn: copy.zoomIn,
            zoomOut: copy.zoomOut,
            centerLocation: copy.centerLocation,
          }}
        />

        {!route && (
          <div className="map-legend" aria-label={copy.severity}>
            <div className="map-legend-title">{copy.severity}</div>
            <div className="map-legend-items">
              <span>
                <i
                  className="map-legend-dot map-legend-caution"
                  aria-hidden="true"
                />
                {copy.severityLabel.caution}
              </span>
              <span>
                <i
                  className="map-legend-dot map-legend-safe"
                  aria-hidden="true"
                />
                {copy.severityLabel.safe}
              </span>
              <span>
                <i
                  className="map-legend-dot map-legend-dangerous"
                  aria-hidden="true"
                />
                {copy.severityLabel.dangerous}
              </span>
              <span>
                <i
                  className="map-legend-dot map-legend-blocked"
                  aria-hidden="true"
                />
                {copy.severityLabel.blocked}
              </span>
            </div>
          </div>
        )}

        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          language={language}
          onSelectTestLocation={handleSelectTestLocation}
          onOpenModeration={() => setModerationOpen(true)}
        />

        <RoutePlanner
          language={language}
          copy={copy}
          userLocation={userLocation}
          onRoute={setRoute}
          destinationRequest={routeDestinationRequest}
          onDestinationRequestHandled={() => setRouteDestinationRequest(null)}
          onHazardSelect={(report) => {
            setSelectedReport(report);
            setSelectedVote(null);
            setSearchLocation({ lat: report.lat, lng: report.lng });
          }}
        />

        {locationPromptOpen && (
          <div
            className="fixed inset-0 z-[1700] flex items-center justify-center bg-[#0F283C]/45 p-4"
            onClick={() => setLocationPromptOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="location-prompt-title"
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2
                    id="location-prompt-title"
                    className="text-xl font-bold text-slate-900"
                  >
                    {copy.locationPromptTitle}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {copy.locationPromptBody}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLocationPromptOpen(false)}
                  aria-label={copy.close}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleAllowLocation}
                  disabled={locationRequesting}
                  className="min-h-12 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:cursor-wait disabled:opacity-70"
                >
                  {locationRequesting
                    ? copy.locationRequesting
                    : copy.allowLocation}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTestLocation(DEFAULT_LOCATION)}
                  disabled={locationRequesting}
                  className="min-h-12 rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  {copy.useTunisTest}
                </button>
                <button
                  type="button"
                  onClick={() => setLocationPromptOpen(false)}
                  disabled={locationRequesting}
                  className="min-h-11 rounded-xl bg-slate-200 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-60"
                >
                  {copy.continueWithoutLocation}
                </button>
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSearch}
          className="search-shell absolute left-1/2 top-[5.25rem] z-[1400] flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 gap-2 md:top-[5.75rem]"
          role="search"
        >
          <label className="sr-only" htmlFor="map-search">
            {copy.search}
          </label>
          <input
            id="map-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => {
              if (searchQuery.trim().length >= 2) setSearchError(false);
              if (searchQuery.trim().length >= 2) {
                setSuggestionRefreshToken((current) => current + 1);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && searchSuggestions.length > 0) {
                event.preventDefault();
                setActiveSuggestionIndex((index) =>
                  Math.min(index + 1, searchSuggestions.length - 1),
                );
              } else if (
                event.key === "ArrowUp" &&
                searchSuggestions.length > 0
              ) {
                event.preventDefault();
                setActiveSuggestionIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
                event.preventDefault();
                const suggestion = searchSuggestions[activeSuggestionIndex];
                if (suggestion) handleSuggestionSelect(suggestion);
              } else if (event.key === "Escape") {
                setSearchSuggestions([]);
                setActiveSuggestionIndex(-1);
              }
            }}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchSuggestions.length > 0 || isSuggesting}
            aria-controls="map-search-suggestions"
            aria-activedescendant={
              activeSuggestionIndex >= 0
                ? `map-search-suggestion-${activeSuggestionIndex}`
                : undefined
            }
            aria-busy={isSuggesting}
            placeholder={copy.searchPlaceholder}
            className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/70 bg-white/90 px-4 text-base text-slate-900 shadow-[0_10px_30px_rgba(15,40,60,0.16)] outline-none backdrop-blur-xl placeholder:text-slate-500 focus:ring-2 focus:ring-[#03AB82]"
          />
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="min-h-12 shrink-0 rounded-2xl bg-[#0F283C] px-4 text-sm font-bold text-white shadow-[0_10px_30px_rgba(15,40,60,0.2)] transition-all hover:-translate-y-0.5 hover:bg-[#173B55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#03AB82] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSearching ? copy.searching : copy.searchSubmit}
          </button>

          {(isSuggesting || searchSuggestions.length > 0) && (
            <div
              id="map-search-suggestions"
              role="listbox"
              className="search-suggestions absolute left-0 right-[calc(4rem+0.5rem)] top-[calc(100%+0.5rem)] max-h-[min(60vh,24rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
            >
              {isSuggesting && (
                <p
                  aria-live="polite"
                  className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500"
                >
                  {copy.searching}
                </p>
              )}
              {searchSuggestions.map((suggestion, index) => (
                <div
                  key={suggestion.placeId}
                  id={`map-search-suggestion-${index}`}
                  role="option"
                  aria-selected={activeSuggestionIndex === index}
                  className={`search-suggestion-item flex min-h-12 items-center gap-2 border-b border-slate-100 px-3 py-2 text-start text-sm transition-colors last:border-b-0 ${
                    activeSuggestionIndex === index ? "is-active" : ""
                  }`}
                  style={{
                    color: "#0f283c",
                    backgroundColor:
                      activeSuggestionIndex === index ? "#eef8f5" : "#ffffff",
                  }}
                >
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className="search-suggestion-name min-h-10 min-w-0 flex-1 truncate text-start"
                  >
                    {suggestion.name}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      handleSuggestionSelect(suggestion);
                      setRouteDestinationRequest(suggestion);
                    }}
                    aria-label={`${copy.routeCheck}: ${suggestion.name}`}
                    title={copy.routeCheck}
                    className="search-suggestion-route"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 17h4l2-5 3 3 2-7 2 4h3" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </form>

        <div className="filter-bar absolute left-1/2 top-[9.15rem] z-[1100] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2">
          <button
            type="button"
            className="filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls="map-filters"
            aria-label={copy.filters}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 6h16M7 12h10m-7 6h4" />
            </svg>
            {(reportTypeFilter !== "all" || reportSeverityFilter !== "all") && (
              <span className="filter-toggle-badge">
                {(reportTypeFilter !== "all" ? 1 : 0) +
                  (reportSeverityFilter !== "all" ? 1 : 0)}
              </span>
            )}
          </button>
          {filtersOpen && (
            <div id="map-filters" className="filter-popover">
              <label className="filter-control">
                <span>{copy.hazardType}</span>
                <select
                  value={reportTypeFilter}
                  onChange={(event) =>
                    setReportTypeFilter(
                      event.target.value as ReportType | "all",
                    )
                  }
                >
                  <option value="all">{copy.allTypes}</option>
                  {REPORT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {copy.type[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-control">
                <span>{copy.severity}</span>
                <select
                  value={reportSeverityFilter}
                  onChange={(event) =>
                    setReportSeverityFilter(
                      event.target.value as ReportSeverity | "all",
                    )
                  }
                >
                  <option value="all">{copy.allSeverities}</option>
                  {REPORT_SEVERITIES.map((severity) => (
                    <option key={severity} value={severity}>
                      {copy.severityLabel[severity]}
                    </option>
                  ))}
                </select>
              </label>
              {(reportTypeFilter !== "all" ||
                reportSeverityFilter !== "all") && (
                <div className="filter-actions">
                  <span className="filter-count">
                    {copy.filters} (
                    {(reportTypeFilter !== "all" ? 1 : 0) +
                      (reportSeverityFilter !== "all" ? 1 : 0)}
                    )
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setReportTypeFilter("all");
                      setReportSeverityFilter("all");
                    }}
                    className="filter-reset"
                  >
                    {copy.resetFilters}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {locationNotice && (
          <div
            role="status"
            className="fixed left-4 right-4 top-4 z-[1700] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/95 p-3.5 text-sm text-amber-950 shadow-2xl backdrop-blur"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📍</span>
              <p className="font-medium text-xs leading-5">{locationNotice}</p>
            </div>
            <button
              type="button"
              onClick={() => setLocationNotice(null)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-amber-900 hover:bg-amber-200"
            >
              ✕
            </button>
          </div>
        )}

        {searchError && (
          <p
            role="status"
            className="absolute left-1/2 top-[12.5rem] z-[1200] -translate-x-1/2 rounded-lg bg-red-700 px-3 py-2 text-center text-sm text-white shadow-lg md:top-[13rem]"
          >
            {copy.searchError}
          </p>
        )}

        {!reportFormOpen && !selectedReport && (
          <button
            type="button"
            onClick={handleReportButtonClick}
            aria-label={copy.report}
            title={copy.report}
            className={`mobile-report-cta fixed z-[1600] flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#03ab82] md:h-[4.5rem] md:w-[4.5rem] ${reportButtonJumping ? "report-cta-jump" : ""}`}
          >
            <svg
              aria-hidden="true"
              className="h-6 w-6 md:h-7 md:w-7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3 21 20H3L12 3Z" />
              <path d="M12 9v5m0 3h.01" />
            </svg>
          </button>
        )}

        {reportFormOpen && (
          <BottomSheet
            onClose={() => setReportFormOpen(false)}
            label={copy.reportTitle}
          >
            <ReportForm
              defaultLat={draftLocation.lat}
              defaultLng={draftLocation.lng}
              language={language}
              onAdjustLocation={() => setReportFormOpen(false)}
              onSubmit={async (input) => {
                await createReportMutation.mutateAsync(input);
              }}
              onCancel={() => setReportFormOpen(false)}
            />
          </BottomSheet>
        )}

        {selectedReport && (
          <BottomSheet
            onClose={() => {
              setSelectedReport(null);
              setSelectedVote(null);
            }}
            label={copy.detailsType}
          >
            <div className="p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">{copy.detailsType}</p>
                  <h2 className="text-lg font-medium text-slate-900">
                    {copy.type[selectedReport.type]}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  aria-label={copy.close}
                  className="flex h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 px-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  <span aria-hidden="true" className="text-xl leading-none">
                    ✕
                  </span>
                </button>
              </div>

              <p className="mb-4 text-sm text-slate-700">
                {formatReportAge(
                  selectedReport.createdAt,
                  selectedReport.lastConfirmedAt,
                  language,
                  copy.recentReport,
                )}
              </p>

              {/* Photo preview if present */}
              {selectedReport.photoUrl && (
                <div className="mb-4">
                  <p className="mb-1.5 text-xs font-semibold text-slate-500">
                    {copy.photoProof}
                  </p>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setEnlargedPhoto(getPhotoFullUrl(selectedReport.photoUrl))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setEnlargedPhoto(
                          getPhotoFullUrl(selectedReport.photoUrl),
                        );
                      }
                    }}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                  >
                    <img
                      src={getPhotoFullUrl(selectedReport.photoUrl) ?? ""}
                      alt={copy.photoProof}
                      className="h-44 w-full object-cover transition duration-200 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition group-hover:opacity-100">
                      <span className="rounded-lg bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                        🔍 {copy.clickToEnlarge}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{copy.severity}</p>
                  <span
                    className={`mt-1.5 inline-block rounded-lg px-2.5 py-1 text-xs font-bold ${
                      selectedReport.severity === "blocked"
                        ? "bg-slate-900 text-white"
                        : selectedReport.severity === "dangerous"
                          ? "bg-red-600 text-white"
                          : selectedReport.severity === "caution"
                            ? "bg-amber-400 text-slate-950"
                            : "bg-emerald-600 text-white"
                    }`}
                  >
                    {copy.severityLabel[selectedReport.severity]}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{copy.confidence}</p>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-slate-900">
                      {selectedReport.confidence}%
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        selectedReport.confidence >= 50
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }`}
                    >
                      ({selectedReport.status})
                    </span>
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{copy.confirmations}</p>
                  <p className="mt-1 font-semibold text-emerald-700">
                    ✓ {selectedReport.confirmationCount}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{copy.disputes}</p>
                  <p className="mt-1 font-semibold text-red-600">
                    ✗ {selectedReport.disputeCount}
                  </p>
                </div>
              </div>

              {selectedReport.description && (
                <p className="mb-4 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  {selectedReport.description}
                </p>
              )}

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={voteMutation.isPending}
                  onClick={() =>
                    voteMutation.mutate({
                      reportId: selectedReport.id,
                      vote: "confirm",
                    })
                  }
                  className={`report-vote-button report-vote-confirm ${selectedVote === "confirm" ? "is-selected" : ""}`}
                >
                  {copy.stillThere}
                </button>
                <button
                  type="button"
                  disabled={voteMutation.isPending}
                  onClick={() =>
                    voteMutation.mutate({
                      reportId: selectedReport.id,
                      vote: "resolved",
                    })
                  }
                  className={`report-vote-button report-vote-resolved ${selectedVote === "resolved" ? "is-selected" : ""}`}
                >
                  {copy.clearNow}
                </button>
                <button
                  type="button"
                  disabled={voteMutation.isPending}
                  onClick={() =>
                    voteMutation.mutate({
                      reportId: selectedReport.id,
                      vote: "dispute",
                    })
                  }
                  className={`report-vote-button report-vote-dispute ${selectedVote === "dispute" ? "is-selected" : ""}`}
                >
                  {copy.dispute}
                </button>
              </div>
              <button
                type="button"
                disabled={flagMutation.isPending}
                onClick={() => flagMutation.mutate(selectedReport.id)}
                className="mt-3 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:cursor-wait disabled:opacity-60"
              >
                {flagMutation.isPending ? copy.flagging : copy.flagReport}
              </button>
            </div>
          </BottomSheet>
        )}

        {actionMessage && (
          <div
            role="status"
            className={`fixed bottom-24 left-4 right-4 z-[1100] mx-auto max-w-md rounded-lg px-4 py-3 text-sm shadow-lg ${
              actionMessage === "success"
                ? "bg-emerald-700 text-white"
                : "bg-red-700 text-white"
            }`}
          >
            {actionMessage === "success"
              ? copy.reportSuccess
              : actionMessage === "flag-success"
                ? copy.flagSent
                : copy.reportError}
          </div>
        )}

        {isLoading && (
          <div className="absolute left-1/2 top-[12.5rem] z-[1200] -translate-x-1/2 rounded bg-white/95 px-3 py-2 text-center text-sm text-slate-700 shadow-lg ring-1 ring-slate-200 md:top-[13rem]">
            {copy.loading}
          </div>
        )}

        {isError && (
          <div className="absolute left-1/2 top-[12.5rem] z-[1200] -translate-x-1/2 rounded bg-red-100 px-3 py-2 text-center text-sm text-red-800 shadow-lg ring-1 ring-red-200 md:top-[13rem]">
            {copy.loadError}
          </div>
        )}

        {!isLoading && !isError && reports.length === 0 && (
          <div className="absolute left-4 right-4 top-20 z-[1000] mx-auto max-w-sm rounded-2xl bg-white/95 p-4 text-center shadow-lg ring-1 ring-slate-200">
            <p className="text-sm text-slate-700">{copy.emptyReports}</p>
          </div>
        )}
        {enlargedPhoto && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={copy.photoProof}
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            onClick={() => setEnlargedPhoto(null)}
          >
            <div className="relative max-h-[90vh] max-w-2xl overflow-hidden rounded-2xl bg-black">
              <button
                type="button"
                onClick={() => setEnlargedPhoto(null)}
                aria-label={copy.close}
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-lg font-bold text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                ✕
              </button>
              <img
                src={enlargedPhoto}
                alt={copy.photoProof}
                className="max-h-[85vh] w-auto object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </div>

      {/* Moderation panel — full-screen overlay */}
      {moderationOpen && (
        <div className="fixed inset-0 z-[2000] overflow-y-auto">
          <div className="sticky top-0 z-10 flex justify-end bg-transparent p-3">
            <button
              type="button"
              onClick={() => setModerationOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white shadow-lg hover:bg-slate-700"
              aria-label={copy.close}
            >
              ✕
            </button>
          </div>
          <div className="-mt-14">
            <ModerationPage language={language} />
          </div>
        </div>
      )}

      {/* Offline toast */}
      {offlineToast && (
        <div className="fixed bottom-24 left-1/2 z-[1900] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xl">
          {offlineToast === "queued" ? copy.offlineQueued : copy.offlineFlushed}
        </div>
      )}
    </>
  );
}
