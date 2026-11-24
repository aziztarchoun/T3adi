import type {
  ReportDto,
  RouteRiskDto,
  RouteRiskRequest,
} from "@road-safety-map/shared";
import { listReports } from "./reports.js";

type OsrmResponse = {
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: Array<[number, number]> };
  }>;
};

const severityWeight: Record<ReportDto["severity"], number> = {
  safe: 0.2,
  caution: 1,
  dangerous: 2,
  blocked: 3,
};

function distanceMeters(a: [number, number], b: [number, number]): number {
  const earthRadius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(b[1] - a[1]);
  const longitudeDelta = toRadians(b[0] - a[0]);
  const latitude = toRadians((a[1] + b[1]) / 2);
  const x = longitudeDelta * Math.cos(latitude);
  const y = latitudeDelta;
  return Math.sqrt(x * x + y * y) * earthRadius;
}

function nearestRouteDistance(
  point: [number, number],
  geometry: Array<[number, number]>,
): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const segment of geometry) {
    nearest = Math.min(nearest, distanceMeters(point, segment));
  }
  return nearest;
}

function routeBounds(origin: RouteRiskRequest, destination: RouteRiskRequest) {
  const padding = 0.02;
  return {
    south: Math.max(
      -90,
      Math.min(origin.originLat, destination.destinationLat) - padding,
    ),
    west: Math.max(
      -180,
      Math.min(origin.originLng, destination.destinationLng) - padding,
    ),
    north: Math.min(
      90,
      Math.max(origin.originLat, destination.destinationLat) + padding,
    ),
    east: Math.min(
      180,
      Math.max(origin.originLng, destination.destinationLng) + padding,
    ),
  };
}

export async function calculateRouteRisk(
  request: RouteRiskRequest,
): Promise<RouteRiskDto> {
  const baseUrl =
    process.env.ROUTING_PROVIDER_URL ?? "https://router.project-osrm.org";
  const coordinates = `${request.originLng},${request.originLat};${request.destinationLng},${request.destinationLat}`;
  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&alternatives=false`,
    { signal: AbortSignal.timeout(8_000) },
  );
  if (!response.ok) {
    throw new Error(`Routing provider returned ${response.status}`);
  }

  const body = (await response.json()) as OsrmResponse;
  const route = body.routes?.[0];
  const geometry = route?.geometry?.coordinates;
  if (!route || !geometry || geometry.length < 2) {
    throw new Error("Routing provider returned no usable route");
  }

  const reports = await listReports(routeBounds(request, request), {
    limit: 500,
  });
  const hazards = reports
    .map((report) => {
      const distance = nearestRouteDistance([report.lng, report.lat], geometry);
      const proximityFactor = Math.max(0, 1 - distance / 150);
      const riskContribution =
        Math.round(
          severityWeight[report.severity] *
            (report.confidence / 100) *
            proximityFactor *
            100,
        ) / 100;
      return { report, distanceMeters: Math.round(distance), riskContribution };
    })
    .filter(
      (hazard) => hazard.distanceMeters <= 150 && hazard.riskContribution > 0,
    )
    .sort((a, b) => b.riskContribution - a.riskContribution);

  const riskScore = Math.min(
    100,
    Math.round(
      hazards.reduce(
        (total, hazard) => total + hazard.riskContribution * 20,
        0,
      ),
    ),
  );
  const riskLabel =
    riskScore >= 60 ? "high" : riskScore >= 25 ? "moderate" : "low";

  return {
    geometry: geometry.map(([lng, lat]) => [lat, lng]),
    distanceMeters: Math.round(route.distance ?? 0),
    durationSeconds: Math.round(route.duration ?? 0),
    riskScore,
    riskLabel,
    hazards,
    advisory:
      riskLabel === "low"
        ? "Few current community hazards were found near this route."
        : "This route has community-reported hazards. Check each warning and use your judgement.",
  };
}
