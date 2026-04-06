import { defineConfig } from "vitest/config";
import path from "path";

// NOTE: jsdom@29 + lru-cache@11 have a Node 22 TLA incompatibility.
// Store tests (Zustand) don't require DOM APIs so we use "node" environment.
// Switch to "jsdom" once the upstream lru-cache ESM/TLA issue is resolved.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["stores/**/*.test.ts", "stores/**/*.test.tsx", "**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
