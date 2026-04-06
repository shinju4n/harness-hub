import { NextRequest, NextResponse } from "next/server";
import { getClaudeHome } from "@/lib/claude-home";
import { readMarkdownFile, readJsonFile } from "@/lib/file-ops";
import { readdir, writeFile, mkdir } from "fs/promises";
import path from "path";
import matter from "gray-matter";

interface AgentDefinition {
  name: string;
  description: string;
  tools?: string[];
  disallowedTools?: string[];
  model?: string;
  permissionMode?: string;
  maxTurns?: number;
  memory?: string;
  background?: boolean;
  effort?: string;
  isolation?: string;
  color?: string;
  initialPrompt?: string;
  body: string;
  filePath: string;
  scope: "user" | "project";
}

interface InboxMessage {
  from: string;
  text: string;
  summary?: string;
  timestamp: string;
  read: boolean;
}

interface TeamAgent {
  name: string;
  team: string;
  messages: InboxMessage[];
  unread: number;
}

export async function GET(request: NextRequest) {
  const claudeHome = getClaudeHome();
  const tab = request.nextUrl.searchParams.get("tab") ?? "definitions";
  const agentName = request.nextUrl.searchParams.get("name");

  if (tab === "definitions") {
    if (agentName) {
      // Return single agent content
      const agentsDir = path.join(claudeHome, "agents");
      const filePath = path.join(agentsDir, `${agentName}.md`);
      const result = await readMarkdownFile(filePath);
      if (result.data) {
        return NextResponse.json({ content: result.data.content, frontmatter: result.data.frontmatter });
      }
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const agents = await readAgentDefinitions(claudeHome);
    return NextResponse.json({ agents, total: agents.length });
  }

  if (tab === "teams") {
    const teams = await readTeamAgents(claudeHome);
    return NextResponse.json({ teams, total: teams.length });
  }

  return NextResponse.json({ error: "Unknown tab" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const claudeHome = getClaudeHome();
  const { name, content } = await request.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const dir = path.join(claudeHome, "agents");
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${name}.md`);
  try {
    await writeFile(filePath, content ?? "", "utf-8");
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const claudeHome = getClaudeHome();
  const name = request.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const filePath = path.join(claudeHome, "agents", `${name}.md`);
  try {
    const { unlink } = await import("fs/promises");
    await unlink(filePath);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const claudeHome = getClaudeHome();
  const { name, content } = await request.json();

  if (!name || typeof content !== "string") {
    return NextResponse.json({ error: "name and content required" }, { status: 400 });
  }

  const filePath = path.join(claudeHome, "agents", `${name}.md`);
  try {
    await writeFile(filePath, content, "utf-8");
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

async function readAgentDefinitions(claudeHome: string): Promise<AgentDefinition[]> {
  const agents: AgentDefinition[] = [];
  const agentsDir = path.join(claudeHome, "agents");

  try {
    const files = await readdir(agentsDir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const filePath = path.join(agentsDir, file);
      const result = await readMarkdownFile(filePath);
      if (!result.data) continue;

      const fm = result.data.frontmatter as Record<string, unknown>;
      agents.push({
        name: (fm.name as string) ?? file.replace(".md", ""),
        description: (fm.description as string) ?? "",
        tools: fm.tools as string[] | undefined,
        disallowedTools: fm.disallowedTools as string[] | undefined,
        model: fm.model as string | undefined,
        permissionMode: fm.permissionMode as string | undefined,
        maxTurns: fm.maxTurns as number | undefined,
        memory: fm.memory as string | undefined,
        background: fm.background as boolean | undefined,
        effort: fm.effort as string | undefined,
        isolation: fm.isolation as string | undefined,
        color: fm.color as string | undefined,
        initialPrompt: fm.initialPrompt as string | undefined,
        body: result.data.content,
        filePath,
        scope: "user",
      });
    }
  } catch {}

  return agents;
}

async function readTeamAgents(claudeHome: string): Promise<TeamAgent[]> {
  const teams: TeamAgent[] = [];
  const teamsDir = path.join(claudeHome, "teams");

  try {
    const teamDirs = await readdir(teamsDir, { withFileTypes: true });
    for (const team of teamDirs) {
      if (!team.isDirectory()) continue;
      const inboxDir = path.join(teamsDir, team.name, "inboxes");
      try {
        const inboxFiles = await readdir(inboxDir);
        for (const file of inboxFiles) {
          if (!file.endsWith(".json")) continue;
          const result = await readJsonFile<InboxMessage[]>(path.join(inboxDir, file));
          const messages = result.data ?? [];
          teams.push({
            name: file.replace(".json", ""),
            team: team.name,
            messages,
            unread: messages.filter((m) => !m.read).length,
          });
        }
      } catch {}
    }
  } catch {}

  return teams;
}
