import { NextRequest, NextResponse } from "next/server";
import { isWebMode } from "@/lib/mode";

// ---------------------------------------------------------------------------
// In-memory session store
// ---------------------------------------------------------------------------

const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

const sessions = new Map<string, { createdAt: number }>();

export function createSession(): string {
  const token = crypto.randomUUID();
  sessions.set(token, { createdAt: Date.now() });
  return token;
}

export function validateSession(token: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

// ---------------------------------------------------------------------------
// Password verification
// ---------------------------------------------------------------------------

export async function verifyPassword(plain: string): Promise<boolean> {
  const hash = process.env.HARNESS_HUB_AUTH_PASS_HASH;
  if (hash) {
    const { compare } = await import("bcryptjs");
    return compare(plain, hash);
  }
  const pass = process.env.HARNESS_HUB_AUTH_PASS;
  if (!pass) return false;
  return plain === pass;
}

// ---------------------------------------------------------------------------
// requireAuth helper — call at the top of every API handler
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Rate limiting — in-memory, per IP, 5 failures → 30s lockout
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW = 30_000; // 30 seconds
const RATE_LIMIT_MAX = 5;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  ip: string,
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (entry && now < entry.resetAt) {
    if (entry.count >= RATE_LIMIT_MAX) {
      return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
    }
    entry.count++;
    return { allowed: true };
  }

  rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
  return { allowed: true };
}

// Periodic cleanup of stale entries (every 60s)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now >= entry.resetAt) rateLimitMap.delete(key);
    }
    // Also clean expired sessions
    for (const [token, session] of sessions) {
      if (now - session.createdAt > SESSION_TTL) sessions.delete(token);
    }
  }, 60_000).unref?.();
}

// ---------------------------------------------------------------------------
// requireAuth helper — call at the top of every API handler
// ---------------------------------------------------------------------------

export async function requireAuth(
  request: NextRequest,
): Promise<NextResponse | null> {
  // Desktop mode — no auth required
  if (!isWebMode()) return null;

  // Explicit opt-out
  if (process.env.HARNESS_HUB_AUTH === "none") return null;

  const token = request.cookies.get("__hh_session")?.value;
  if (token && validateSession(token)) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
