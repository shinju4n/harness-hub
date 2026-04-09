"use client";

import { Panel, Group, Separator } from "react-resizable-panels";
import { useTerminalStore } from "@/stores/terminal-store";
import { TerminalDockWrapper } from "./terminal-dock-wrapper";
import { SetupBanner } from "./setup-banner";

/**
 * When the terminal is closed, render a plain container.
 * When open, split vertically with a Group — main content on top, terminal on
 * bottom. Re-keying the Group on `isOpen` guarantees the defaultLayout ratio
 * is re-applied each time the dock appears, so toggling doesn't get stuck on
 * a stale saved ratio.
 */
export function LayoutShell({ children }: { children: React.ReactNode }) {
  const isOpen = useTerminalStore((s) => s.isOpen);

  const mainContent = (
    <main className="h-full overflow-y-auto">
      <SetupBanner />
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-w-0">
      {isOpen ? (
        <Group
          key="with-terminal"
          id="harness-hub-terminal-layout"
          orientation="vertical"
          defaultLayout={{ main: 65, terminal: 35 }}
        >
          <Panel id="main" minSize="20%">
            {mainContent}
          </Panel>
          <Separator className="group h-1 flex items-center justify-center hover:bg-amber-500 dark:hover:bg-amber-500 transition-colors bg-gray-200 dark:bg-gray-800" />
          <Panel id="terminal" minSize="15%" maxSize="70%">
            <TerminalDockWrapper />
          </Panel>
        </Group>
      ) : (
        <div className="flex-1 overflow-hidden">{mainContent}</div>
      )}
    </div>
  );
}
