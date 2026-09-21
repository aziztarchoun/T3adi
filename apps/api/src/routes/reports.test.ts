import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
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

  it("rejects search queries that are too short", async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/api/search?q=a`);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("at least 2 characters");
  });
});
