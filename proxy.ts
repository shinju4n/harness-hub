import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";
import {
  detectLocaleFromAcceptLanguage,
  getLocaleFromPathname,
  hasLocale,
  localeCookieName,
  localizePathname,
  stripLocaleFromPathname,
  type Locale,
} from "@/lib/i18n/config";

function isWebMode(): boolean {
  return process.env.HARNESS_HUB_MODE === "web";
}

function resolveLocale(request: NextRequest): Locale {
  const pathnameLocale = getLocaleFromPathname(request.nextUrl.pathname);
  if (pathnameLocale) return pathnameLocale;

  const cookieLocale = request.cookies.get(localeCookieName)?.value;
  if (cookieLocale && hasLocale(cookieLocale)) return cookieLocale;

  return detectLocaleFromAcceptLanguage(request.headers.get("accept-language"));
}

function withLocaleCookie(response: NextResponse, locale: Locale) {
  response.cookies.set(localeCookieName, locale, {
    path: "/",
    sameSite: "lax",
  });
  return response;
}

function isPageRequest(pathname: string) {
  if (pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/_next/")) return false;
  if (pathname === "/favicon.ico") return false;
  return !/\.[^/]+$/.test(pathname);
}

function isLoginPath(pathname: string) {
  return stripLocaleFromPathname(pathname) === "/login";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = resolveLocale(request);

  if (isPageRequest(pathname) && !getLocaleFromPathname(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = localizePathname(pathname, locale);
    return withLocaleCookie(NextResponse.redirect(redirectUrl), locale);
  }

  if (!isWebMode()) {
    return withLocaleCookie(NextResponse.next(), locale);
  }

  // Auth explicitly disabled
  if (process.env.HARNESS_HUB_AUTH === "none") {
    return withLocaleCookie(NextResponse.next(), locale);
  }

  // Login/logout and health probes must bypass auth — the matcher below
  // is supposed to exclude these, but this guard is defense-in-depth against
  // matcher regex drift so a misconfigured matcher can never lock users out.
  if (
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/health" ||
    isLoginPath(pathname)
  ) {
    return withLocaleCookie(NextResponse.next(), locale);
  }

  // -----------------------------------------------------------------------
  // CSRF protection for mutating requests
  // -----------------------------------------------------------------------
  const method = request.method;
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    const origin = request.headers.get("origin");
    const secFetchSite = request.headers.get("sec-fetch-site");

    // Allow same-origin requests
    if (secFetchSite && secFetchSite === "same-origin") {
      // OK
    } else if (origin) {
      const requestUrl = new URL(request.url);
      const originUrl = new URL(origin);
      if (originUrl.origin !== requestUrl.origin) {
        return NextResponse.json(
          { error: "CSRF: origin mismatch" },
          { status: 403 },
        );
      }
    }
    // If neither header is present AND the request carries a session cookie,
    // it could be a cross-site form POST with enctype="text/plain" (which
    // can omit both Origin and Sec-Fetch-Site). Block these to prevent CSRF.
    // Legitimate headless/CLI callers typically don't carry browser cookies.
    if (!origin && !secFetchSite) {
      const hasCookie = request.cookies.has("__hh_session");
      if (hasCookie) {
        return NextResponse.json(
          { error: "CSRF: missing Origin and Sec-Fetch-Site headers" },
          { status: 403 },
        );
      }
    }
  }

  // -----------------------------------------------------------------------
  // Session check
  // -----------------------------------------------------------------------
  const token = request.cookies.get("__hh_session")?.value;
  const valid = token ? validateSession(token) : false;

  if (!valid) {
    // API routes → 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pages → redirect to /login
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = localizePathname("/login", locale);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return withLocaleCookie(NextResponse.next(), locale);
}

export const proxyConfig = {
  matcher: [
    "/api/((?!auth/|health).*)",
    "/((?!_next/static|_next/image|favicon.ico|api/auth|api/health).*)",
  ],
};
