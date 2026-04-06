"use client";

import dynamic from "next/dynamic";

const ThemeProvider = dynamic(
  () => import("@/components/theme-provider").then((m) => ({ default: m.ThemeProvider })),
  { ssr: false }
);

export function ThemeProviderWrapper() {
  return <ThemeProvider />;
}
