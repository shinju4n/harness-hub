import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Harness Hub",
  description: "Claude Code harness manager",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-gray-50 text-gray-900 antialiased">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
            <h1 className="text-lg font-semibold">Harness Hub</h1>
            <span className="text-sm text-gray-400 font-mono">~/.claude</span>
          </header>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
          <footer className="border-t border-gray-200 bg-white px-6 py-2 text-xs text-gray-400" id="status-bar">
            Detecting Claude Code...
          </footer>
        </div>
      </body>
    </html>
  );
}
