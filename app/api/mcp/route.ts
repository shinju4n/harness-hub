import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import { readJsonFile, writeJsonFile } from "@/lib/file-ops";
import path from "path";

export async function GET(request: NextRequest) {
  const claudeHome = getClaudeHomeFromRequest(request);
  const result = await readJsonFile<{ mcpServers: Record<string, { command: string; args?: string[] }> }>(
    path.join(claudeHome, ".mcp.json")
  );
  return NextResponse.json({
    servers: result.data?.mcpServers ?? {},
    mtime: result.mtime,
  });
}

export async function PUT(request: NextRequest) {
  const claudeHome = getClaudeHomeFromRequest(request);
  const mcpPath = path.join(claudeHome, ".mcp.json");
  const { servers, mtime } = await request.json();

  const result = await writeJsonFile(mcpPath, { mcpServers: servers }, mtime);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}
