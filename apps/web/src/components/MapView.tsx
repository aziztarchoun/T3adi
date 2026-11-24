import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { ReportDto } from "@road-safety-map/shared";
import type { ReportBounds } from "../api/reports";
import type { RouteRiskDto } from "@road-safety-map/shared";

const TUNIS_CENTER: [number, number] = [36.8065, 10.1815];
const DEFAULT_ZOOM = 12;
const USER_LOCATION_ZOOM = 14;

// MapTiler is our tile provider (see docs/PROJECT_PLAN.md Phase 3) —
// a free-tier key that gets restricted to this site's domain in the
// MapTiler dashboard, never a server secret. If no key is configured
// (e.g. a contributor running the app locally without one yet), fall
// back to CARTO's free tiles so the app still works out of the box.
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const CARTO_KEY = import.meta.env.VITE_CARTO_KEY;

const TILE_URL = CARTO_KEY
  ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`
  : MAPTILER_KEY
    ? `https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

const TILE_ATTRIBUTION = CARTO_KEY
  ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  : MAPTILER_KEY
    ? '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

if (!MAPTILER_KEY && !CARTO_KEY && import.meta.env.DEV) {
  console.warn(
    "No map tile key is set — CARTO may show an API key watermark. See .env.example.",
  );
}

const markerColors: Record<string, string> = {
  safe: "var(--sev-safe)",
  caution: "var(--sev-attention)",
  dangerous: "var(--sev-danger)",
  blocked: "var(--sev-blocked)",
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
  onBoundsChange?: (bounds: ReportBounds) => void;
  route?: RouteRiskDto | null;
  mapLabels: {
    mapControls: string;
    zoomIn: string;
    zoomOut: string;
    centerLocation: string;
  };
}

function createPinIcon(color: string, animated = false) {
  return L.divIcon({
    className: "t3adi-pin-wrapper",
    html: `<span class="t3adi-pin ${animated ? "selected-pin" : ""}" style="--pin-color:${color}"><span class="t3adi-pin-core"></span></span>`,
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

function MapSizeHandler() {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize({ animate: false });
    const frame = window.requestAnimationFrame(invalidate);
    window.addEventListener("resize", invalidate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", invalidate);
    };
  }, [map]);

  return null;
}

function MapViewportHandler({
  onBoundsChange,
}: {
  onBoundsChange?: (bounds: ReportBounds) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!onBoundsChange) return;

    const updateBounds = () => {
      const bounds = map.getBounds();
      onBoundsChange({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      });
    };

    updateBounds();
    map.on("moveend", updateBounds);
    return () => {
      map.off("moveend", updateBounds);
    };
  }, [map, onBoundsChange]);

  return null;
}

function MapControls({
  userLocation,
  labels,
}: {
  userLocation?: { lat: number; lng: number } | null;
  labels: MapViewProps["mapLabels"];
}) {
  const map = useMap();

  return (
    <div className="map-control-panel" aria-label={labels.mapControls}>
      <button
        type="button"
        className="map-control-button"
        aria-label={labels.zoomIn}
        title={labels.zoomIn}
        onClick={() => map.zoomIn()}
      >
        <span aria-hidden="true">+</span>
      </button>
      <button
        type="button"
        className="map-control-button"
        aria-label={labels.zoomOut}
        title={labels.zoomOut}
        onClick={() => map.zoomOut()}
      >
        <span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        className="map-control-button map-control-location"
        aria-label={labels.centerLocation}
        title={labels.centerLocation}
        disabled={!userLocation}
        onClick={() => {
          if (!userLocation) return;
          map.flyTo([userLocation.lat, userLocation.lng], USER_LOCATION_ZOOM, {
            duration: 0.7,
          });
        }}
      >
        <span aria-hidden="true">⌖</span>
      </button>
    </div>
  );
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
  onBoundsChange,
  route,
  mapLabels,
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
      style={{ height: "100%", width: "100%" }}
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
      <MapSizeHandler />
      <MapViewportHandler onBoundsChange={onBoundsChange} />
      <MapControls userLocation={userLocation} labels={mapLabels} />
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

      {route && (
        <Polyline
          positions={route.geometry}
          pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.8 }}
        />
      )}

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
          report.status === "resolved"
            ? "resolved"
            : report.severity === "blocked"
              ? "blocked"
              : report.severity;

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
