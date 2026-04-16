import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("middleware", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load() {
    const { proxy: middleware } = await import("../../proxy");
    const { NextRequest } = await import("next/server");
    return { middleware, NextRequest };
  }

  function makeReq(
    NextRequest: typeof import("next/server").NextRequest,
    url: string,
    init?: { method?: string; cookie?: string; origin?: string; secFetchSite?: string },
  ) {
    const headers = new Headers();
    if (init?.cookie) headers.set("cookie", init.cookie);
    if (init?.origin) headers.set("origin", init.origin);
    if (init?.secFetchSite) headers.set("sec-fetch-site", init.secFetchSite);
    return new NextRequest(url, { method: init?.method ?? "GET", headers });
  }

  describe("desktop mode", () => {
    it("passes through every route without auth", async () => {
      vi.stubEnv("HARNESS_HUB_MODE", "desktop");
      const { middleware, NextRequest } = await load();

      const res = middleware(makeReq(NextRequest, "http://localhost/api/agents"));
      // NextResponse.next() has no status override → treated as pass-through
      expect(res.status).toBe(200);
    });

    it("redirects non-localized pages to the default locale", async () => {
      vi.stubEnv("HARNESS_HUB_MODE", "desktop");
      const { middleware, NextRequest } = await load();

      const res = middleware(makeReq(NextRequest, "http://localhost/login"));

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost/en/login");
    });
  });

  describe("web mode — unauthenticated", () => {
    beforeEach(() => {
      vi.stubEnv("HARNESS_HUB_MODE", "web");
      vi.stubEnv("HARNESS_HUB_AUTH", "");
    });

    it("lets /api/auth/login through so the handler can return Invalid credentials", async () => {
      const { middleware, NextRequest } = await load();
      const res = middleware(
        makeReq(NextRequest, "http://localhost/api/auth/login", {
          method: "POST",
          secFetchSite: "same-origin",
        }),
      );
      expect(res.status).toBe(200);
    });

    it("lets /api/auth/logout through", async () => {
      const { middleware, NextRequest } = await load();
      const res = middleware(
        makeReq(NextRequest, "http://localhost/api/auth/logout", {
          method: "POST",
          secFetchSite: "same-origin",
        }),
      );
      expect(res.status).toBe(200);
    });

    it("lets /api/health through for container probes", async () => {
      const { middleware, NextRequest } = await load();
      const res = middleware(makeReq(NextRequest, "http://localhost/api/health"));
      expect(res.status).toBe(200);
    });

    it("still blocks unauthenticated /api/agents with 401", async () => {
      const { middleware, NextRequest } = await load();
      const res = middleware(makeReq(NextRequest, "http://localhost/api/agents"));
      expect(res.status).toBe(401);
    });

    it("redirects / to a locale-specific route before auth", async () => {
      const { middleware, NextRequest } = await load();
      const res = middleware(makeReq(NextRequest, "http://localhost/"));

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost/en");
    });

    it("lets localized login pages through without a session", async () => {
      const { middleware, NextRequest } = await load();
      const res = middleware(makeReq(NextRequest, "http://localhost/ko/login"));

      expect(res.status).toBe(200);
    });
  });

  describe("web mode — auth disabled", () => {
    it("passes everything when HARNESS_HUB_AUTH=none", async () => {
      vi.stubEnv("HARNESS_HUB_MODE", "web");
      vi.stubEnv("HARNESS_HUB_AUTH", "none");
      const { middleware, NextRequest } = await load();
      const res = middleware(makeReq(NextRequest, "http://localhost/api/agents"));
      expect(res.status).toBe(200);
    });
  });
});
