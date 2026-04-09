import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("__hh_session")?.value;
  if (token) {
    deleteSession(token);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("__hh_session", "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return res;
}
