import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The real marker throws outside the React server environment; production
      // server-only resolution is verified separately by build/import checks.
      "server-only": fileURLToPath(new URL("./tests/harness/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx", "tests/security/**/*.test.ts"],
    testTimeout: 10000,
  },
});
