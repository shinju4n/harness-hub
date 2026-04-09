import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSession, checkRateLimit } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: block brute-force attempts
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${rl.retryAfterSeconds}s.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      );
    }

    const { username, password } = await request.json();

    const expectedUser = process.env.HARNESS_HUB_AUTH_USER || "admin";
    if (username !== expectedUser) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const valid = await verifyPassword(password ?? "");
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const token = createSession();
    const res = NextResponse.json({ ok: true });
    res.cookies.set("__hh_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 86400,
    });
    return res;
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 },
    );
  }
}
