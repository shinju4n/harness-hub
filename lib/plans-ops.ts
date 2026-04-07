import { readdir, stat, readFile } from "fs/promises";
import path from "path";
import { readMarkdownFile } from "./file-ops";

export interface PlanSummary {
  name: string;
  fileName: string;
  title: string;
  description: string;
  mtime: number;
}

export interface PlanDetail {
  name: string;
  fileName: string;
  frontmatter: Record<string, unknown>;
  content: string;
  rawContent: string;
  mtime: number;
}

function isSafeName(name: string): boolean {
  return !(name.includes("..") || name.includes("/") || name.includes("\\"));
}

export async function readPlans(claudeHome: string): Promise<PlanSummary[]> {
  const dir = path.join(claudeHome, "plans");
  const plans: PlanSummary[] = [];

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const filePath = path.join(dir, file);
    const [parsed, fileStat] = await Promise.all([
      readMarkdownFile(filePath),
      stat(filePath).catch(() => null),
    ]);
    if (!parsed.data || !fileStat) continue;

    const fm = parsed.data.frontmatter as Record<string, unknown>;
    const name = file.replace(/\.md$/, "");
    plans.push({
      name,
      fileName: file,
      title: (fm.title as string) ?? name,
      description: (fm.description as string) ?? "",
      mtime: fileStat.mtimeMs,
    });
  }

  plans.sort((a, b) => b.mtime - a.mtime);
  return plans;
}

export async function readPlan(claudeHome: string, name: string): Promise<PlanDetail | null> {
  if (!isSafeName(name)) throw new Error("Invalid plan name");

  const filePath = path.join(claudeHome, "plans", `${name}.md`);
  const parsed = await readMarkdownFile(filePath);
  if (!parsed.data) return null;

  let rawContent = "";
  let mtime = 0;
  try {
    rawContent = await readFile(filePath, "utf-8");
    const s = await stat(filePath);
    mtime = s.mtimeMs;
  } catch {}

  return {
    name,
    fileName: `${name}.md`,
    frontmatter: parsed.data.frontmatter,
    content: parsed.data.content,
    rawContent,
    mtime,
  };
}
