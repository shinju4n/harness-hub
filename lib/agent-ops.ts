import { readdir } from "fs/promises";
import path from "path";
import { readMarkdownFile } from "./file-ops";

export interface AgentDefinition {
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
  skills?: string[];
  body: string;
  filePath: string;
  scope: "user" | "project";
}

function parseSkills(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((s): s is string => typeof s === "string" && s.length > 0);
}

export async function readAgentDefinitions(claudeHome: string): Promise<AgentDefinition[]> {
  const agents: AgentDefinition[] = [];
  const agentsDir = path.join(claudeHome, "agents");

  let files: string[];
  try {
    files = await readdir(agentsDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

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
      skills: parseSkills(fm.skills),
      body: result.data.content,
      filePath,
      scope: "user",
    });
  }

  return agents;
}
