import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import { readMarkdownFile } from "@/lib/file-ops";
import { readPlans } from "@/lib/plans-ops";
import { readSessions } from "@/lib/sessions-ops";
import { listHookFiles } from "@/lib/hook-files-ops";
import { readdir } from "fs/promises";
import path from "path";

export type SearchResult = {
  category: "Pages" | "Agents" | "Plans" | "Hook Scripts" | "Sessions" | "History";
  title: string;
  subtitle?: string;
  href: string;
};

const PAGES: SearchResult[] = [
  { category: "Pages", title: "Dashboard", href: "/" },
  { category: "Pages", title: "Plugins", href: "/plugins" },
  { category: "Pages", title: "Skills", href: "/skills" },
  { category: "Pages", title: "Commands", href: "/commands" },
  { category: "Pages", title: "Hooks", href: "/hooks" },
  { category: "Pages", title: "MCP", href: "/mcp" },
  { category: "Pages", title: "Agents", href: "/agents" },
  { category: "Pages", title: "Rules", href: "/rules" },
  { category: "Pages", title: "Memory", href: "/memory" },
  { category: "Pages", title: "Sessions", href: "/sessions" },
  { category: "Pages", title: "Plans", href: "/plans" },
  { category: "Pages", title: "History", href: "/history" },
  { category: "Pages", title: "CLAUDE.md", href: "/claude-md" },
  { category: "Pages", title: "Settings", href: "/settings" },
  { category: "Pages", title: "App Settings", href: "/app-settings" },
  { category: "Pages", title: "Keybindings", href: "/keybindings" },
];

const LIMIT_PER_CATEGORY = 8;
const LIMIT_TOTAL = 30;

function matches(q: string, ...fields: (string | undefined)[]): boolean {
  const lower = q.toLowerCase();
  return fields.some((f) => f && f.toLowerCase().includes(lower));
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  let claudeHome: string;
  try {
    claudeHome = getClaudeHomeFromRequest(request);
  } catch {
    return NextResponse.json({ results: [] });
  }

  const results: SearchResult[] = [];

  // Pages — static list, always present
  const pageMatches = PAGES.filter((p) => matches(q, p.title, p.href));
  for (const p of pageMatches.slice(0, LIMIT_PER_CATEGORY)) {
    results.push(p);
  }

  // Agents
  try {
    const agentsDir = path.join(claudeHome, "agents");
    const files = await readdir(agentsDir).catch(() => [] as string[]);
    const agentResults: SearchResult[] = [];
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const filePath = path.join(agentsDir, file);
      const parsed = await readMarkdownFile(filePath);
      if (!parsed.data) continue;
      const fm = parsed.data.frontmatter as Record<string, unknown>;
      const name = (fm.name as string) ?? file.replace(".md", "");
      const description = (fm.description as string) ?? "";
      if (matches(q, name, description)) {
        agentResults.push({
          category: "Agents",
          title: name,
          subtitle: description || undefined,
          href: "/agents",
        });
      }
      if (agentResults.length >= LIMIT_PER_CATEGORY) break;
    }
    results.push(...agentResults);
  } catch {
    // skip if agents dir missing
  }

  // Plans
  try {
    const plans = await readPlans(claudeHome);
    const planResults: SearchResult[] = [];
    for (const plan of plans) {
      if (matches(q, plan.title, plan.description, plan.name)) {
        planResults.push({
          category: "Plans",
          title: plan.title,
          subtitle: plan.description || undefined,
          href: "/plans",
        });
      }
      if (planResults.length >= LIMIT_PER_CATEGORY) break;
    }
    results.push(...planResults);
  } catch {
    // skip
  }

  // Hook Scripts
  try {
    const hookFiles = await listHookFiles(claudeHome);
    const hookResults: SearchResult[] = [];
    for (const hf of hookFiles) {
      if (matches(q, hf.name)) {
        hookResults.push({
          category: "Hook Scripts",
          title: hf.name,
          subtitle: hf.language,
          href: "/hooks",
        });
      }
      if (hookResults.length >= LIMIT_PER_CATEGORY) break;
    }
    results.push(...hookResults);
  } catch {
    // skip
  }

  // Sessions
  try {
    const sessions = await readSessions(claudeHome);
    const sessionResults: SearchResult[] = [];
    for (const s of sessions.slice(0, 50)) {
      const shortId = s.sessionId.slice(0, 8);
      const cwdShort = s.cwd ? path.basename(s.cwd) : "";
      if (matches(q, s.sessionId, s.cwd, cwdShort)) {
        sessionResults.push({
          category: "Sessions",
          title: shortId,
          subtitle: s.cwd || undefined,
          href: "/sessions",
        });
      }
      if (sessionResults.length >= LIMIT_PER_CATEGORY) break;
    }
    results.push(...sessionResults);
  } catch {
    // skip
  }

  // History — page-level only
  if (matches(q, "history", "conversation")) {
    results.push({
      category: "History",
      title: "History",
      subtitle: "Browse conversation history",
      href: "/history",
    });
  }

  // Enforce total limit
  const limited = results.slice(0, LIMIT_TOTAL);

  return NextResponse.json({ results: limited });
}
