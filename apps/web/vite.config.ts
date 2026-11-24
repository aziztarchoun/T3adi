import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const useHttps =
    process.env.VITE_HTTPS === "true" || process.env.HTTPS === "true";

  return {
    base: mode === "production" ? "/T3adi/" : "/",
    envDir: "../..",
    plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
    server: {
      host: "0.0.0.0",
      port: 5173,
      https: useHttps ? {} : undefined,
      proxy: {
        "/api": "http://localhost:4000",
        "/uploads": "http://localhost:4000",
      },
    },
  };
});
