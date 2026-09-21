import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import reportsRouter from "./routes/reports.js";
import searchRouter from "./routes/search.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(","),
    }),
  );
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/reports", reportsRouter);
  app.use("/api/search", searchRouter);

  return app;
}

const app = createApp();
const port = process.env.PORT ?? 4000;

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}
