import fs from "node:fs/promises";
import { createServer, type Server as HttpServer } from "node:http";
import type { Server } from "node:http";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { getReportFreshness } from "../services/reports.js";
import { cleanSearchName } from "./search.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error?: Error) => {
            if (error) reject(error);
            else resolve();
          });
        }),
    ),
  );
});

async function startServer() {
  const app = createApp();
  const server = app.listen(0) as Server;
  servers.push(server);

  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server did not start with a TCP port");
  }

  return `http://127.0.0.1:${address.port}`;
}

async function startRoutingStub(statusCode: number, body: unknown) {
  const stub: HttpServer = createServer((_req, res) => {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => {
    stub.listen(0, "127.0.0.1", resolve);
  });
  const address = stub.address();
  if (!address || typeof address === "string") {
    throw new Error("Routing stub did not start with a TCP port");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        stub.closeAllConnections();
        stub.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function withRoutingProvider<T>(
  url: string,
  run: () => Promise<T>,
): Promise<T> {
  const previous = process.env.ROUTING_PROVIDER_URL;
  process.env.ROUTING_PROVIDER_URL = url;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.ROUTING_PROVIDER_URL;
    else process.env.ROUTING_PROVIDER_URL = previous;
  }
}

describe("reports API", () => {
  it("reports database readiness", async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/api/health/ready`);
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ready" });
  });

  it("decays freshness according to report type", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const afterFourHours = createdAt.getTime() + 4 * 60 * 60 * 1000;

    const agingFlooding = getReportFreshness(
      "flooding",
      createdAt,
      createdAt,
      afterFourHours,
    );
    expect(agingFlooding.expired).toBe(false);
    expect(agingFlooding.recencyFactor).toBeCloseTo(2 / 3);
    expect(
      getReportFreshness(
        "flooding",
        createdAt,
        createdAt,
        createdAt.getTime() + 8 * 60 * 60 * 1000,
      ),
    ).toMatchObject({ expired: true, recencyFactor: 0 });
  });

  it("removes administrative details from search labels", () => {
    expect(
      cleanSearchName(
        "Café Journal, نهج المسك, سوسة, خزامة, معتمدية سوسة المدينة, ولاية سوسة, 4051, تونس",
      ),
    ).toBe("Café Journal, نهج المسك, سوسة, خزامة");
  });

  it("returns a list of reports", async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/api/reports`);
    const body = (await response.json()) as Array<Record<string, unknown>>;

    expect(response.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toMatchObject({
      id: expect.any(String),
      lat: expect.any(Number),
      lng: expect.any(Number),
      type: expect.any(String),
      severity: expect.any(String),
    });
  });

  it("rejects invalid report IDs before querying the database", async () => {
    const baseUrl = await startServer();

    const response = await fetch(
      `${baseUrl}/api/reports/not-a-uuid/confirmations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: "confirm" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid report ID" });
  });

  it("rejects inverted map bounds", async () => {
    const baseUrl = await startServer();

    const response = await fetch(
      `${baseUrl}/api/reports?south=37&west=11&north=36&east=10`,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid map bounds" });
  });

  it("rejects invalid route coordinates", async () => {
    const baseUrl = await startServer();

    const response = await fetch(
      `${baseUrl}/api/routes/risk?originLat=bad&originLng=10&destinationLat=36&destinationLng=10`,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid route coordinates",
    });
  });

  it("accepts a new report submission", async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: 36.8,
        lng: 10.18,
        type: "pothole",
        severity: "dangerous",
        description: "Large pothole near the intersection",
      }),
    });

    expect(response.status).toBe(201);

    const created = await response.json();
    expect(created).toMatchObject({
      lat: 36.8,
      lng: 10.18,
      type: "pothole",
      severity: "dangerous",
      description: "Large pothole near the intersection",
      status: "active",
    });
  });

  it("merges nearby recent reports into one confirmation", async () => {
    const baseUrl = await startServer();
    const payload = {
      lat: 36.70123,
      lng: 10.10123,
      type: "pothole",
      severity: "dangerous",
    };

    const firstResponse = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Token": "duplicate-test-a",
      },
      body: JSON.stringify(payload),
    });
    const first = (await firstResponse.json()) as {
      id: string;
      confirmationCount: number;
    };

    const secondResponse = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Token": "duplicate-test-b",
      },
      body: JSON.stringify({ ...payload, lat: 36.7015, lng: 10.1014 }),
    });
    const second = (await secondResponse.json()) as {
      id: string;
      confirmationCount: number;
    };

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(second.id).toBe(first.id);
    expect(second.confirmationCount).toBeGreaterThanOrEqual(
      first.confirmationCount,
    );
  });

  it("limits repeated writes from the same device", async () => {
    const baseUrl = await startServer();
    const previousLimit = process.env.RATE_LIMIT_MAX_WRITES;
    process.env.RATE_LIMIT_MAX_WRITES = "2";

    try {
      const headers = {
        "Content-Type": "application/json",
        "X-Device-Token": "rate-limit-test",
      };
      const makeRequest = (index: number) =>
        fetch(`${baseUrl}/api/reports`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            lat: 36.71 + index * 0.001,
            lng: 10.11 + index * 0.001,
            type: "other",
            severity: "caution",
          }),
        });

      await makeRequest(0);
      await makeRequest(1);
      const limited = await makeRequest(2);
      expect(limited.status).toBe(429);
    } finally {
      if (previousLimit === undefined) delete process.env.RATE_LIMIT_MAX_WRITES;
      else process.env.RATE_LIMIT_MAX_WRITES = previousLimit;
    }
  });

  it("accepts a report flag once per device and reason", async () => {
    const baseUrl = await startServer();
    const listResponse = await fetch(`${baseUrl}/api/reports`);
    const reports = (await listResponse.json()) as Array<{ id: string }>;
    const headers = {
      "Content-Type": "application/json",
      "X-Device-Token": "flag-test-device",
    };

    const first = await fetch(`${baseUrl}/api/reports/${reports[0].id}/flags`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reason: "inaccurate" }),
    });
    const second = await fetch(
      `${baseUrl}/api/reports/${reports[0].id}/flags`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ reason: "inaccurate" }),
      },
    );

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
  });

  it("protects moderation endpoints with the moderator token", async () => {
    const baseUrl = await startServer();
    const previousToken = process.env.MODERATOR_TOKEN;
    process.env.MODERATOR_TOKEN = "moderator-test-token";

    try {
      const unauthorized = await fetch(`${baseUrl}/api/moderation/flags`);
      const authorized = await fetch(`${baseUrl}/api/moderation/flags`, {
        headers: { Authorization: "Bearer moderator-test-token" },
      });

      expect(unauthorized.status).toBe(401);
      expect(authorized.status).toBe(200);
      expect(Array.isArray(await authorized.json())).toBe(true);

      const reportsResponse = await fetch(`${baseUrl}/api/reports`);
      const reports = (await reportsResponse.json()) as Array<{ id: string }>;
      const moderationHeaders = {
        Authorization: "Bearer moderator-test-token",
      };
      const hidden = await fetch(
        `${baseUrl}/api/moderation/reports/${reports[0].id}/hide`,
        { method: "POST", headers: moderationHeaders },
      );
      const unhidden = await fetch(
        `${baseUrl}/api/moderation/reports/${reports[0].id}/unhide`,
        { method: "POST", headers: moderationHeaders },
      );

      expect(hidden.status).toBe(200);
      expect(unhidden.status).toBe(200);
    } finally {
      if (previousToken === undefined) delete process.env.MODERATOR_TOKEN;
      else process.env.MODERATOR_TOKEN = previousToken;
    }
  });

  it("rejects search queries that are too short", async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/api/search?q=a`);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("at least 2 characters");
  });

  it("returns a stable error for malformed JSON", async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid",
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid JSON payload" });
  });

  it("rejects oversized JSON payloads", async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "x".repeat(40_000) }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(413);
    expect(body).toEqual({ error: "Request payload is too large" });
  });

  it("updates report confidence after a confirmation vote", async () => {
    const baseUrl = await startServer();

    const listResponse = await fetch(`${baseUrl}/api/reports`);
    const reports = (await listResponse.json()) as Array<{ id: string }>;
    const response = await fetch(
      `${baseUrl}/api/reports/${reports[0].id}/confirmations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: "confirm" }),
      },
    );
    const updated = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(updated.confirmationCount).toEqual(expect.any(Number));
    expect(updated.lastConfirmedAt).toEqual(expect.any(String));
    expect(updated.confidence).toEqual(expect.any(Number));
  });

  it("rejects a photo upload with no file", async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/api/reports/upload`, {
      method: "POST",
      body: new FormData(),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "No photo file provided",
    });
  });

  it("rejects a photo upload with an unsupported content type", async () => {
    const baseUrl = await startServer();
    const formData = new FormData();
    formData.append(
      "photo",
      new Blob([new Uint8Array([1, 2, 3])], { type: "text/plain" }),
      "notes.txt",
    );

    const response = await fetch(`${baseUrl}/api/reports/upload`, {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Only JPEG, PNG and WEBP images are supported",
    });
  });

  it("rejects a photo larger than the size limit", async () => {
    const baseUrl = await startServer();
    const formData = new FormData();
    formData.append(
      "photo",
      new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/png" }),
      "huge.png",
    );

    const response = await fetch(`${baseUrl}/api/reports/upload`, {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toEqual(expect.any(String));
  });

  it("accepts a photo upload and serves it back", async () => {
    const baseUrl = await startServer();
    const formData = new FormData();
    formData.append(
      "photo",
      new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], {
        type: "image/png",
      }),
      "hazard.png",
    );

    const response = await fetch(`${baseUrl}/api/reports/upload`, {
      method: "POST",
      body: formData,
    });
    const body = (await response.json()) as { photoUrl: string };

    expect(response.status).toBe(201);
    expect(body.photoUrl).toMatch(
      /^\/uploads\/\d+-[0-9a-f]{16}\.(jpg|jpeg|png|webp)$/,
    );

    const served = await fetch(`${baseUrl}${body.photoUrl}`);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toMatch(/^image\//);

    const uploadedPath = path.join(
      process.cwd(),
      "uploads",
      path.basename(body.photoUrl),
    );
    await fs.unlink(uploadedPath).catch(() => undefined);
  });

  it("scores a confirmed report sitting on the route as a hazard", async () => {
    const baseUrl = await startServer();
    const stub = await startRoutingStub(200, {
      routes: [
        {
          distance: 1_000,
          duration: 300,
          geometry: {
            coordinates: [
              [10.1, 36.7],
              [10.15, 36.75],
              [10.2, 36.8],
            ],
          },
        },
      ],
    });

    try {
      const createdResponse = await fetch(`${baseUrl}/api/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Token": "route-hazard-test",
        },
        body: JSON.stringify({
          lat: 36.75,
          lng: 10.15,
          type: "accident_obstacle",
          severity: "blocked",
        }),
      });
      const created = (await createdResponse.json()) as { id: string };
      expect(createdResponse.status).toBe(201);

      const voteResponse = await fetch(
        `${baseUrl}/api/reports/${created.id}/confirmations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Device-Token": "route-hazard-test",
          },
          body: JSON.stringify({ vote: "confirm" }),
        },
      );
      expect(voteResponse.status).toBe(200);

      const risk = await withRoutingProvider(stub.url, () =>
        fetch(
          `${baseUrl}/api/routes/risk?originLat=36.70&originLng=10.10&destinationLat=36.80&destinationLng=10.20`,
        ),
      );
      const body = (await risk.json()) as {
        geometry: Array<[number, number]>;
        distanceMeters: number;
        durationSeconds: number;
        riskScore: number;
        riskLabel: string;
        hazards: Array<{
          report: { id: string };
          distanceMeters: number;
          riskContribution: number;
        }>;
        advisory: string;
      };

      expect(risk.status).toBe(200);
      expect(body.geometry[0]).toEqual([36.7, 10.1]);
      expect(body.distanceMeters).toBe(1_000);
      expect(body.durationSeconds).toBe(300);
      expect(body.riskScore).toBeGreaterThan(0);
      expect(body.riskScore).toBeLessThanOrEqual(100);

      const hazard = body.hazards.find(
        (entry) => entry.report.id === created.id,
      );
      expect(hazard).toBeDefined();
      expect(hazard?.distanceMeters).toBeLessThanOrEqual(150);
      expect(hazard?.riskContribution).toBeGreaterThan(0);
      expect(body.advisory).toEqual(expect.any(String));
      expect(body.advisory.length).toBeGreaterThan(0);
    } finally {
      await stub.close();
    }
  });

  it("reports a low risk when no reports are near the route", async () => {
    const baseUrl = await startServer();
    const stub = await startRoutingStub(200, {
      routes: [
        {
          distance: 5_000,
          duration: 600,
          geometry: {
            coordinates: [
              [9.0, 34.5],
              [9.05, 34.55],
            ],
          },
        },
      ],
    });

    try {
      const risk = await withRoutingProvider(stub.url, () =>
        fetch(
          `${baseUrl}/api/routes/risk?originLat=34.50&originLng=9.00&destinationLat=34.55&destinationLng=9.05`,
        ),
      );
      const body = (await risk.json()) as {
        riskScore: number;
        riskLabel: string;
        hazards: unknown[];
        advisory: string;
      };

      expect(risk.status).toBe(200);
      expect(body.riskScore).toBe(0);
      expect(body.riskLabel).toBe("low");
      expect(body.hazards).toEqual([]);
      expect(body.advisory).toEqual(expect.any(String));
      expect(body.advisory.length).toBeGreaterThan(0);
    } finally {
      await stub.close();
    }
  });

  it("returns an error when the routing provider fails", async () => {
    const baseUrl = await startServer();
    const stub = await startRoutingStub(500, { error: "upstream failed" });

    try {
      const risk = await withRoutingProvider(stub.url, () =>
        fetch(
          `${baseUrl}/api/routes/risk?originLat=36.70&originLng=10.10&destinationLat=36.80&destinationLng=10.20`,
        ),
      );

      expect(risk.status).toBe(500);
      expect(await risk.json()).toEqual({ error: "Internal server error" });
    } finally {
      await stub.close();
    }
  });

  it("returns 404 when dismissing flags for an unknown report", async () => {
    const baseUrl = await startServer();
    const previousToken = process.env.MODERATOR_TOKEN;
    process.env.MODERATOR_TOKEN = "moderator-test-token";

    try {
      const response = await fetch(
        `${baseUrl}/api/moderation/reports/00000000-0000-4000-8000-00000000dead/dismiss`,
        {
          method: "POST",
          headers: { Authorization: "Bearer moderator-test-token" },
        },
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Report not found" });
    } finally {
      if (previousToken === undefined) delete process.env.MODERATOR_TOKEN;
      else process.env.MODERATOR_TOKEN = previousToken;
    }
  });

  it("dismisses open flags so they leave the moderation queue", async () => {
    const baseUrl = await startServer();
    const previousToken = process.env.MODERATOR_TOKEN;
    process.env.MODERATOR_TOKEN = "moderator-test-token";
    const seconds = Math.floor(Date.now() / 1_000);
    const uniqueLatitude = 36.65 + (seconds % 60) * 0.001;
    const uniqueLongitude = 10.05 + (Math.floor(seconds / 60) % 60) * 0.001;
    const deviceToken = `dismiss-test-${seconds}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const createdResponse = await fetch(`${baseUrl}/api/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Token": deviceToken,
        },
        body: JSON.stringify({
          lat: uniqueLatitude,
          lng: uniqueLongitude,
          type: "other",
          severity: "caution",
        }),
      });
      const created = (await createdResponse.json()) as { id: string };
      expect(createdResponse.status).toBe(201);

      const flagResponse = await fetch(
        `${baseUrl}/api/reports/${created.id}/flags`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Device-Token": deviceToken,
          },
          body: JSON.stringify({ reason: "inaccurate" }),
        },
      );
      expect(flagResponse.status).toBe(202);

      const moderationHeaders = {
        Authorization: "Bearer moderator-test-token",
      };
      const before = (await (
        await fetch(`${baseUrl}/api/moderation/flags`, {
          headers: moderationHeaders,
        })
      ).json()) as Array<{ reportId: string }>;
      expect(before.some((flag) => flag.reportId === created.id)).toBe(true);

      const dismissed = await fetch(
        `${baseUrl}/api/moderation/reports/${created.id}/dismiss`,
        { method: "POST", headers: moderationHeaders },
      );
      expect(dismissed.status).toBe(200);
      expect(await dismissed.json()).toEqual({
        id: created.id,
        status: "active",
      });

      const after = (await (
        await fetch(`${baseUrl}/api/moderation/flags`, {
          headers: moderationHeaders,
        })
      ).json()) as Array<{ reportId: string }>;
      expect(after.some((flag) => flag.reportId === created.id)).toBe(false);
    } finally {
      if (previousToken === undefined) delete process.env.MODERATOR_TOKEN;
      else process.env.MODERATOR_TOKEN = previousToken;
    }
  });
});
