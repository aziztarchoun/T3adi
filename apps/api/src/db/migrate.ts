import dotenv from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool, closeDatabase } from "./client.js";

dotenv.config({
  path:
    process.env.DOTENV_CONFIG_PATH ??
    fileURLToPath(new URL("../../../../.env", import.meta.url)),
});

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run migrations");
  }

  const migrationsDirectory = fileURLToPath(
    new URL("./migrations", import.meta.url),
  );
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const migrationFile of migrationFiles) {
    const migration = await readFile(
      `${migrationsDirectory}/${migrationFile}`,
      "utf8",
    );
    await pool.query(migration);
    console.log(`Applied ${migrationFile}`);
  }
}

migrate()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
