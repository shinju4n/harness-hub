import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import {
  listHookFiles,
  readHookFile,
  writeHookFile,
  createHookFile,
  deleteHookFile,
} from "@/lib/hook-files-ops";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const name = request.nextUrl.searchParams.get("name");

    if (name) {
      try {
        const file = await readHookFile(claudeHome, name);
        if (!file) {
          return NextResponse.json({ error: "Hook file not found" }, { status: 404 });
        }
        return NextResponse.json(file);
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
      }
    }

    const files = await listHookFiles(claudeHome);
    return NextResponse.json({ files, total: files.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const { name, content } = await request.json();
    if (typeof name !== "string" || typeof content !== "string") {
      return NextResponse.json({ error: "name and content required" }, { status: 400 });
    }
    await createHookFile(claudeHome, name, content);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = (err as Error).message;
    const status = /already exists/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const { name, content } = await request.json();
    if (typeof name !== "string" || typeof content !== "string") {
      return NextResponse.json({ error: "name and content required" }, { status: 400 });
    }
    await writeHookFile(claudeHome, name, content);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const name = request.nextUrl.searchParams.get("name");
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const ok = await deleteHookFile(claudeHome, name);
    if (!ok) {
      return NextResponse.json({ error: "Hook file not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
