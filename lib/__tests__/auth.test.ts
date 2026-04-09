import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("auth", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe("verifyPassword", () => {
    it("verifies against bcrypt hash", async () => {
      const bcryptjs = await import("bcryptjs");
      const hash = await bcryptjs.hash("secret123", 10);
      vi.stubEnv("HARNESS_HUB_AUTH_PASS_HASH", hash);
      vi.stubEnv("HARNESS_HUB_AUTH_PASS", "");

      const { verifyPassword } = await import("../auth");
      expect(await verifyPassword("secret123")).toBe(true);
      expect(await verifyPassword("wrong")).toBe(false);
    });

    it("verifies against plain text password", async () => {
      vi.stubEnv("HARNESS_HUB_AUTH_PASS_HASH", "");
      vi.stubEnv("HARNESS_HUB_AUTH_PASS", "mypassword");

      const { verifyPassword } = await import("../auth");
      expect(await verifyPassword("mypassword")).toBe(true);
      expect(await verifyPassword("wrong")).toBe(false);
    });

    it("returns false when no password is configured", async () => {
      vi.stubEnv("HARNESS_HUB_AUTH_PASS_HASH", "");
      vi.stubEnv("HARNESS_HUB_AUTH_PASS", "");

      const { verifyPassword } = await import("../auth");
      expect(await verifyPassword("anything")).toBe(false);
    });
  });

  describe("session lifecycle", () => {
    it("creates, validates, and deletes sessions", async () => {
      const { createSession, validateSession, deleteSession } = await import(
        "../auth"
      );

      const token = createSession();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
      expect(validateSession(token)).toBe(true);

      deleteSession(token);
      expect(validateSession(token)).toBe(false);
    });

    it("rejects expired sessions", async () => {
      const { createSession, validateSession } = await import("../auth");

      const token = createSession();
      expect(validateSession(token)).toBe(true);

      // Fast-forward time by 25 hours
      const realNow = Date.now;
      Date.now = () => realNow() + 25 * 60 * 60 * 1000;
      try {
        expect(validateSession(token)).toBe(false);
      } finally {
        Date.now = realNow;
      }
    });

    it("rejects unknown tokens", async () => {
      const { validateSession } = await import("../auth");
      expect(validateSession("nonexistent-token")).toBe(false);
    });
  });

  describe("requireAuth", () => {
    function makeRequest(cookie?: string) {
      const headers = new Headers();
      if (cookie) {
        headers.set("cookie", `__hh_session=${cookie}`);
      }
      return new Request("http://localhost/api/test", { headers }) as unknown;
    }

    it("returns null in desktop mode (no-op)", async () => {
      vi.stubEnv("HARNESS_HUB_MODE", "desktop");

      const { requireAuth } = await import("../auth");
      const { NextRequest } = await import("next/server");
      const req = new NextRequest("http://localhost/api/test");
      expect(await requireAuth(req)).toBeNull();
    });

    it("returns null when auth=none in web mode", async () => {
      vi.stubEnv("HARNESS_HUB_MODE", "web");
      vi.stubEnv("HARNESS_HUB_AUTH", "none");

      const { requireAuth } = await import("../auth");
      const { NextRequest } = await import("next/server");
      const req = new NextRequest("http://localhost/api/test");
      expect(await requireAuth(req)).toBeNull();
    });

    it("returns null for valid session in web mode", async () => {
      vi.stubEnv("HARNESS_HUB_MODE", "web");
      vi.stubEnv("HARNESS_HUB_AUTH", "");

      const { requireAuth, createSession } = await import("../auth");
      const { NextRequest } = await import("next/server");

      const token = createSession();
      const req = new NextRequest("http://localhost/api/test", {
        headers: { cookie: `__hh_session=${token}` },
      });

      expect(await requireAuth(req)).toBeNull();
    });

    it("returns 401 for invalid session in web mode", async () => {
      vi.stubEnv("HARNESS_HUB_MODE", "web");
      vi.stubEnv("HARNESS_HUB_AUTH", "");

      const { requireAuth } = await import("../auth");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest("http://localhost/api/test", {
        headers: { cookie: "__hh_session=bad-token" },
      });

      const result = await requireAuth(req);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });

    it("returns 401 when no session cookie in web mode", async () => {
      vi.stubEnv("HARNESS_HUB_MODE", "web");
      vi.stubEnv("HARNESS_HUB_AUTH", "");

      const { requireAuth } = await import("../auth");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest("http://localhost/api/test");
      const result = await requireAuth(req);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });
  });
});
