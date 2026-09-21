import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { ReportDto } from "@road-safety-map/shared";
import { createReport } from "../api/reports";
import { searchPlaces, type SearchSuggestion } from "../api/search";
import MapView from "../components/MapView";
import MapHeader from "../components/MapHeader";
import ReportForm from "../components/ReportForm";
import Sidebar from "../components/Sidebar";
import { useReports } from "../hooks/useReports";
import { translations, type Language } from "../i18n";

const DEFAULT_LOCATION = { lat: 36.8065, lng: 10.1815 };
const WEB_BASE_URL =
  (
    import.meta as ImportMeta & {
      env?: Record<string, string | undefined>;
    }
  ).env?.BASE_URL ?? "/";

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

  return (
    <div
      className="fixed inset-0 z-[1500] bg-black/20 px-3 pb-3 pt-16"
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
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="mx-auto max-h-[calc(100vh-76px)] max-w-md overflow-y-auto rounded-t-[28px] bg-white shadow-[0_-8px_30px_rgba(15,23,42,0.18)] transition-transform duration-200"
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
  const [reportFormOpen, setReportFormOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportDto | null>(null);
  const [language, setLanguage] = useState<Language>("fr");
  const [actionMessage, setActionMessage] = useState<
    "success" | "error" | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLocation, setSearchLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<
    SearchSuggestion[]
  >([]);
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
  const skipSuggestionFetchRef = useRef(false);
  const queryClient = useQueryClient();
  const { data: reports = [], isLoading, isError } = useReports();
  const copy = translations[language];

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
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextLocation = { lat: coords.latitude, lng: coords.longitude };
        setUserLocation(nextLocation);
        setDraftLocation(nextLocation);
      },
      () => {
        setUserLocation(null);
        setDraftLocation(DEFAULT_LOCATION);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const createReportMutation = useMutation({
    mutationFn: createReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setReportFormOpen(false);
      setSelectedReport(null);
      setActionMessage("success");
    },
    onError: () => setActionMessage("error"),
  });

  const handleReportButtonClick = () => {
    setSelectedReport(null);
    setActionMessage(null);
    setReportFormOpen(true);
  };

  const handleMapSelection = (location: { lat: number; lng: number }) => {
    setSearchSuggestions([]);
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
    setSearchError(false);
    setDraftLocation(location);
    setSearchLocation(location);
    setSelectionPulse((current) => current + 1);
  };

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setSearchSuggestions([]);
    setIsSearching(true);
    setSearchError(false);

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
        onReportSelect={setSelectedReport}
      />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        language={language}
      />

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
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={searchSuggestions.length > 0 || isSuggesting}
          aria-controls="map-search-suggestions"
          aria-busy={isSuggesting}
          placeholder={copy.searchPlaceholder}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white/95 px-4 text-base text-slate-900 shadow-lg outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-slate-900"
        />
        <button
          type="submit"
          disabled={isSearching || !searchQuery.trim()}
          className="min-h-11 shrink-0 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white shadow-lg transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
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
            {searchSuggestions.map((suggestion) => (
              <button
                key={suggestion.placeId}
                type="button"
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSuggestionSelect(suggestion)}
                className="block min-h-11 w-full border-b border-slate-100 px-4 py-3 text-start text-sm text-slate-800 transition-colors last:border-b-0 hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900"
              >
                {suggestion.name}
              </button>
            ))}
          </div>
        )}
      </form>

      {searchError && (
        <p
          role="status"
          className="absolute left-1/2 top-[9rem] z-[1200] -translate-x-1/2 rounded-lg bg-red-700 px-3 py-2 text-center text-sm text-white shadow-lg md:top-[9.5rem]"
        >
          {copy.searchError}
        </p>
      )}

      <button
        type="button"
        onClick={handleReportButtonClick}
        className={`mobile-report-cta fixed left-3 right-3 z-[1250] h-14 rounded-xl bg-slate-900 px-5 text-base font-medium text-white shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 md:bottom-6 md:left-auto md:right-6 md:w-auto md:rounded-full ${reportButtonJumping ? "report-cta-jump" : ""}`}
      >
        {copy.report}
      </button>

      {reportFormOpen && (
        <BottomSheet
          onClose={() => setReportFormOpen(false)}
          label={copy.reportTitle}
        >
          <ReportForm
            defaultLat={draftLocation.lat}
            defaultLng={draftLocation.lng}
            language={language}
            onSubmit={async (input) => {
              await createReportMutation.mutateAsync(input);
            }}
            onCancel={() => setReportFormOpen(false)}
          />
        </BottomSheet>
      )}

      {selectedReport && (
        <BottomSheet
          onClose={() => setSelectedReport(null)}
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
              {selectedReport.freshnessSummary || copy.recentReport}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="min-h-[48px] rounded-xl bg-slate-900 px-3 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                {copy.stillThere}
              </button>
              <button
                type="button"
                className="min-h-[48px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                {copy.clearNow}
              </button>
            </div>
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
          {actionMessage === "success" ? copy.reportSuccess : copy.reportError}
        </div>
      )}

      {isLoading && (
        <div className="absolute left-1/2 top-[9rem] z-[1200] -translate-x-1/2 rounded bg-white/95 px-3 py-2 text-center text-sm text-slate-700 shadow-lg ring-1 ring-slate-200 md:top-[9.5rem]">
          {copy.loading}
        </div>
      )}

      {isError && (
        <div className="absolute left-1/2 top-[9rem] z-[1200] -translate-x-1/2 rounded bg-red-100 px-3 py-2 text-center text-sm text-red-800 shadow-lg ring-1 ring-red-200 md:top-[9.5rem]">
          {copy.loadError}
        </div>
      )}

      {!isLoading && !isError && reports.length === 0 && (
        <div className="absolute left-4 top-20 z-[1000] rounded-lg bg-white/95 px-3 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200">
          {copy.emptyReports}
        </div>
      )}
    </div>
  );
}
