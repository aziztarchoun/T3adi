/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Status colors matching docs/PROJECT_PLAN.md Phase 6
        safe: "#16a34a",
        caution: "#eab308",
        dangerous: "#dc2626",
        blocked: "#18181b",
      },
    },
  },
  plugins: [],
};
