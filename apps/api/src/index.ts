import cors from "cors";
import dotenv from "dotenv";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { closeDatabase, pool } from "./db/client.js";
import moderationRouter from "./routes/moderation.js";
import reportsRouter from "./routes/reports.js";
import searchRouter from "./routes/search.js";

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH ?? "../../.env" });

export function createApp() {
  const app = express();
  const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
    }),
  );
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/health/ready", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      return res.json({ status: "ready" });
    } catch {
      return res.status(503).json({ status: "not_ready" });
    }
  });

  app.use("/api/reports", reportsRouter);
  app.use("/api/moderation", moderationRouter);
  app.use("/api/search", searchRouter);

  const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
    void next;

    if (error instanceof SyntaxError && "body" in error) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }

    if (
      error instanceof Error &&
      "type" in error &&
      error.type === "entity.too.large"
    ) {
      return res.status(413).json({ error: "Request payload is too large" });
    }

    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  };

  app.use(errorHandler);

  return app;
}

const app = createApp();
const port = process.env.PORT ?? 4000;

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down`);
    server.close(() => {
      void closeDatabase().finally(() => process.exit(0));
    });
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}
