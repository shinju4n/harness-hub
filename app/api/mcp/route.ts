import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import { readJsonFile, writeJsonFile } from "@/lib/file-ops";
import path from "path";
import { requireAuth } from "@/lib/auth";

async function findMcpPath(claudeHome: string): Promise<{ filePath: string; data: Record<string, unknown> | null; mtime?: number }> {
  // Try inside claudeHome first, then parent (project-level .claude/)
  const inside = await readJsonFile<Record<string, unknown>>(path.join(claudeHome, ".mcp.json"));
  if (inside.data) return { filePath: path.join(claudeHome, ".mcp.json"), data: inside.data, mtime: inside.mtime };

  const parent = await readJsonFile<Record<string, unknown>>(path.join(path.dirname(claudeHome), ".mcp.json"));
  if (parent.data) return { filePath: path.join(path.dirname(claudeHome), ".mcp.json"), data: parent.data, mtime: parent.mtime };

  return { filePath: path.join(claudeHome, ".mcp.json"), data: null };
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  const claudeHome = getClaudeHomeFromRequest(request);
  const { data, mtime } = await findMcpPath(claudeHome);
  const mcpData = data as { mcpServers?: Record<string, { command: string; args?: string[] }> } | null;
  return NextResponse.json({
    servers: mcpData?.mcpServers ?? {},
    mtime,
  });
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  const claudeHome = getClaudeHomeFromRequest(request);
  const { servers, mtime } = await request.json();
  const { filePath } = await findMcpPath(claudeHome);

  const current = await readJsonFile(filePath);
  const result = await writeJsonFile(filePath, { mcpServers: servers }, current.mtime ?? mtime);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}
