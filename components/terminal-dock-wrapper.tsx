"use client";

import dynamic from "next/dynamic";
import { useTerminalStore } from "@/stores/terminal-store";

// xterm touches `window` and `document` on import — must be client-only.
const TerminalDock = dynamic(
  () => import("./terminal-dock").then((m) => m.TerminalDock),
  { ssr: false },
);

export function TerminalDockWrapper() {
  const isOpen = useTerminalStore((s) => s.isOpen);
  if (!isOpen) return null;
  return <TerminalDock />;
}
