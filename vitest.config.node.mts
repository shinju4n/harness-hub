import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "lib/**/*.test.ts",
      "electron-src/__tests__/**/*.test.ts",
      "stores/**/*.test.ts",
      "stores/**/*.test.tsx",
      "**/*.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
