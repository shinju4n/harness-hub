import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Next.js standalone file tracing scans the project root and pulls in any
  // file it thinks the server might reference. Without these excludes it
  // slurps `dist-electron/` and `electron/` into `.next/standalone/`, which
  // electron-builder then copies into `app.asar.unpacked/` — producing a
  // recursive package (previous build's .app inside the new .app) and a
  // codesign failure.
  outputFileTracingExcludes: {
    "*": [
      "./dist-electron/**/*",
      "./electron/**/*",
      "./docs/**/*",
      "./build/**/*",
    ],
  },
};

export default nextConfig;
