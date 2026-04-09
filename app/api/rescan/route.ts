import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import path from "path";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  const claudeHome = getClaudeHomeFromRequest(request);
  const userDataPath = request.headers.get("x-user-data-path");
  const profileId = request.headers.get("x-profile-id");

  if (!userDataPath || !profileId) {
    return NextResponse.json({ error: "Version history not available" }, { status: 503 });
  }

  const versionBase = path.join(userDataPath, "versions", profileId);
  const { runRescan } = await import("@/lib/external-rescan");

  let scopedItem: { kind: "skill" | "agent"; name: string } | undefined;

  // Try parsing Claude Code hook payload
  try {
    const body = await request.json();
    const filePath: string | undefined = body?.tool_input?.file_path;
    if (filePath) {
      const skillsDir = path.join(claudeHome, "skills");
      const agentsDir = path.join(claudeHome, "agents");
      if (filePath.startsWith(skillsDir + path.sep) || filePath.startsWith(skillsDir + "/")) {
        const rel = filePath.slice(skillsDir.length + 1);
        const name = rel.split(path.sep)[0] || rel.split("/")[0];
        if (name) scopedItem = { kind: "skill", name };
      } else if (filePath.startsWith(agentsDir + path.sep) || filePath.startsWith(agentsDir + "/")) {
        const fileName = path.basename(filePath, ".md");
        if (fileName) scopedItem = { kind: "agent", name: fileName };
      } else {
        return NextResponse.json({ skipped: true, reason: "file not tracked" });
      }
    }
  } catch {
    // Empty body or parse error = full rescan
  }

  try {
    const report = await runRescan({ versionBase, homePath: claudeHome, profileId, scopedItem });
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
