import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SidebarWrapper } from "@/components/sidebar-wrapper";
import { ThemeProviderWrapper } from "@/components/theme-provider-wrapper";
import { TerminalHotkey } from "@/components/use-terminal-hotkey";
import { LayoutShell } from "@/components/layout-shell";
import { ToastContainer } from "@/components/toast-container";
import { CommandPalette } from "@/components/command-palette";
import { VersionHistoryProvider } from "@/components/version-history-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  defaultLocale,
  hasLocale,
  localeCookieName,
} from "@/lib/i18n/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "Harness Hub",
  description: "Claude Code harness manager",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const locale =
    cookieLocale && hasLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const dictionary = await getDictionary(locale);

  return (
    <html lang={locale}>
      <body className="flex h-screen bg-gray-50/80 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased font-sans">
        <I18nProvider locale={locale} dictionary={dictionary}>
          <ThemeProviderWrapper />
          <SidebarWrapper />
          <VersionHistoryProvider>
            <LayoutShell>{children}</LayoutShell>
          </VersionHistoryProvider>
          <TerminalHotkey />
          <ToastContainer />
          <CommandPalette />
        </I18nProvider>
      </body>
    </html>
  );
}
