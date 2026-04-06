import { NextRequest, NextResponse } from "next/server";
import { getClaudeHome } from "@/lib/claude-home";
import { readdir } from "fs/promises";
import { readJsonFile } from "@/lib/file-ops";
import path from "path";

interface InboxMessage {
  from: string;
  text: string;
  summary?: string;
  timestamp: string;
  read: boolean;
}

interface AgentInfo {
  name: string;
  team: string;
  messages: InboxMessage[];
  unread: number;
}

export async function GET(request: NextRequest) {
  const claudeHome = getClaudeHome();
  const teamsDir = path.join(claudeHome, "teams");

  const agents: AgentInfo[] = [];

  try {
    const teams = await readdir(teamsDir, { withFileTypes: true });
    for (const team of teams) {
      if (!team.isDirectory()) continue;
      const inboxDir = path.join(teamsDir, team.name, "inboxes");
      try {
        const inboxFiles = await readdir(inboxDir);
        for (const file of inboxFiles) {
          if (!file.endsWith(".json")) continue;
          const agentName = file.replace(".json", "");
          const result = await readJsonFile<InboxMessage[]>(path.join(inboxDir, file));
          const messages = result.data ?? [];
          agents.push({
            name: agentName,
            team: team.name,
            messages,
            unread: messages.filter((m) => !m.read).length,
          });
        }
      } catch {}
    }
  } catch {}

  return NextResponse.json({ agents, total: agents.length });
}
