import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { ReportDto } from "@road-safety-map/shared";

const TUNIS_CENTER: [number, number] = [36.8065, 10.1815];
const DEFAULT_ZOOM = 12;
const USER_LOCATION_ZOOM = 14;

// MapTiler is our tile provider (see docs/PROJECT_PLAN.md Phase 3) —
// a free-tier key that gets restricted to this site's domain in the
// MapTiler dashboard, never a server secret. If no key is configured
// (e.g. a contributor running the app locally without one yet), fall
// back to CARTO's free tiles so the app still works out of the box.
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

const TILE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`
  : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

const TILE_ATTRIBUTION = MAPTILER_KEY
  ? '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

if (!MAPTILER_KEY && import.meta.env.DEV) {
  console.warn(
    "VITE_MAPTILER_KEY is not set — falling back to CARTO tiles. See .env.example.",
  );
}

const markerColors: Record<string, string> = {
  safe: "#22c55e",
  caution: "#facc15",
  dangerous: "#ef4444",
  blocked: "#111827",
  active: "#ef4444",
  resolved: "#22c55e",
  expired: "#94a3b8",
  hidden: "#64748b",
};

interface MapViewProps {
  reports: ReportDto[];
  userLocation?: { lat: number; lng: number } | null;
  draftLocation?: { lat: number; lng: number } | null;
  onDraftLocationChange?: (location: { lat: number; lng: number }) => void;
  onMapClick?: (location: { lat: number; lng: number }) => void;
  searchLocation?: { lat: number; lng: number } | null;
  selectionPulse?: number;
  onReportSelect?: (report: ReportDto) => void;
}

function createPinIcon(color: string, animated = false) {
  return L.divIcon({
    className: "",
    html: `<span class="${animated ? "selected-pin" : ""}" style="display:block;width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid rgba(255,255,255,0.96);box-shadow:0 2px 8px rgba(15,23,42,0.25);"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
  });
}

function SearchLocationHandler({
  location,
}: {
  location?: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!location) return;
    map.panTo([location.lat, location.lng], {
      animate: true,
      duration: 0.8,
    });
  }, [location, map]);

  return null;
}

function UserLocationHandler({
  location,
}: {
  location?: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!location) return;
    map.setView([location.lat, location.lng], USER_LOCATION_ZOOM, {
      animate: false,
    });
  }, [location, map]);

  return null;
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick?: (location: { lat: number; lng: number }) => void;
}) {
  useMapEvents({
    click: (event) => {
      const { lat, lng } = event.latlng;
      onMapClick?.({ lat, lng });
    },
  });

  return null;
}

export default function MapView({
  reports,
  userLocation,
  draftLocation,
  onDraftLocationChange,
  onMapClick,
  searchLocation,
  selectionPulse = 0,
  onReportSelect,
}: MapViewProps) {
  const markerRef = useRef<any>(null);
  const selectedPinIcon = useMemo(
    () => createPinIcon("#2563eb", true),
    [selectionPulse],
  );
  const reportPinIcons = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(markerColors).map(([tone, color]) => [
          tone,
          createPinIcon(color),
        ]),
      ),
    [],
  );

  return (
    <MapContainer
      center={TUNIS_CENTER}
      zoom={DEFAULT_ZOOM}
      className="h-full w-full"
      zoomControl={false}
      scrollWheelZoom
      wheelDebounceTime={40}
      wheelPxPerZoomLevel={120}
      dragging
      touchZoom
      preferCanvas
      zoomAnimation={false}
      fadeAnimation={false}
      markerZoomAnimation={false}
    >
      <MapClickHandler onMapClick={onMapClick} />
      <SearchLocationHandler location={searchLocation} />
      <UserLocationHandler location={userLocation} />

      <TileLayer
        url={TILE_URL}
        updateWhenIdle
        keepBuffer={2}
        detectRetina={false}
        maxZoom={20}
        attribution={TILE_ATTRIBUTION}
      />

      {userLocation && (
        <Circle
          center={[userLocation.lat, userLocation.lng]}
          radius={24}
          pathOptions={{
            color: "#2563eb",
            fillColor: "#2563eb",
            fillOpacity: 0.15,
            weight: 2,
          }}
        />
      )}

      {draftLocation && (
        <Marker
          ref={markerRef}
          position={[draftLocation.lat, draftLocation.lng]}
          draggable
          icon={selectedPinIcon}
          zIndexOffset={1000}
          eventHandlers={{
            dragend: () => {
              const marker = markerRef.current;
              if (!marker) return;
              const point = marker.getLatLng();
              onDraftLocationChange?.({ lat: point.lat, lng: point.lng });
            },
          }}
        />
      )}

      {reports.map((report) => {
        const tone =
          report.severity === "blocked" ? "blocked" : report.severity;

        return (
          <Marker
            key={report.id}
            position={[report.lat, report.lng]}
            icon={reportPinIcons[tone] ?? reportPinIcons.dangerous}
            zIndexOffset={report.severity === "blocked" ? 200 : 100}
            eventHandlers={{
              click: () => onReportSelect?.(report),
            }}
          />
        );
      })}
    </MapContainer>
  );
}
