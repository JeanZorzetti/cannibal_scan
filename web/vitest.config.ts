import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resolve the same `@/*` -> `src/*` alias used by Next/tsconfig so unit tests can
// import modules the way the app does.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
  },
});
