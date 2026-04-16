export const locales = ["en", "ko"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";
export const localeCookieName = "__hh_locale";

export function hasLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getLocaleFromPathname(pathname: string): Locale | null {
  const [maybeLocale] = pathname.split("/").filter(Boolean);
  return maybeLocale && hasLocale(maybeLocale) ? maybeLocale : null;
}

export function stripLocaleFromPathname(pathname: string): string {
  const locale = getLocaleFromPathname(pathname);
  if (!locale) return pathname || "/";

  const stripped = pathname.slice(locale.length + 1);
  return stripped.startsWith("/") ? stripped : stripped ? `/${stripped}` : "/";
}

export function localizePathname(pathname: string, locale: Locale): string {
  if (!pathname.startsWith("/")) return pathname;

  const normalized = stripLocaleFromPathname(pathname);
  return normalized === "/" ? `/${locale}` : `/${locale}${normalized}`;
}

export function detectLocaleFromAcceptLanguage(header: string | null): Locale {
  if (!header) return defaultLocale;

  const candidates = header
    .split(",")
    .map((part) => part.trim().split(";")[0]?.toLowerCase())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === "ko" || candidate?.startsWith("ko-")) return "ko";
    if (candidate === "en" || candidate?.startsWith("en-")) return "en";
  }

  return defaultLocale;
}
