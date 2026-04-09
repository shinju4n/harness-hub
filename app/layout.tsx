import type { Metadata } from "next";
import { SidebarWrapper } from "@/components/sidebar-wrapper";
import { ThemeProviderWrapper } from "@/components/theme-provider-wrapper";
import { TerminalHotkey } from "@/components/use-terminal-hotkey";
import { LayoutShell } from "@/components/layout-shell";
import { ToastContainer } from "@/components/toast-container";
import { CommandPalette } from "@/components/command-palette";
import { VersionHistoryProvider } from "@/components/version-history-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Harness Hub",
  description: "Claude Code harness manager",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-gray-50/80 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased font-sans">
        <ThemeProviderWrapper />
        <SidebarWrapper />
        <VersionHistoryProvider>
          <LayoutShell>{children}</LayoutShell>
        </VersionHistoryProvider>
        <TerminalHotkey />
        <ToastContainer />
        <CommandPalette />
      </body>
    </html>
  );
}
