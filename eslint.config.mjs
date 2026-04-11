import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Compiled Electron output — CommonJS emitted from electron-src/
    "electron/**",
    "dist-electron/**",
    // Compiled server output — CommonJS emitted from server-src/
    "dist-server/**",
  ]),
]);

export default eslintConfig;
