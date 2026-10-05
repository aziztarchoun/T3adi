import type { Server } from "node:http";
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
});
