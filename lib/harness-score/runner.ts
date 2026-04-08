import path from "path";
import { readdir, readFile } from "fs/promises";
import matter from "gray-matter";
import { readJsonFile, readMarkdownFile } from "../file-ops";
import { evaluateAll } from "./rules";
import {
  AgentFile,
  Category,
  CategoryScore,
  ClaudeMdFile,
  Finding,
  isHookMap,
  ScanInputs,
  ScoreReport,
  SettingsSnapshot,
  SkillEntry,
  SEVERITY_PENALTY,
} from "./types";
import { CATEGORIES } from "./labels";

async function collectAgents(claudeHome: string): Promise<AgentFile[]> {
  const dir = path.join(claudeHome, "agents");
  const out: AgentFile[] = [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const filePath = path.join(dir, entry);
    try {
      const raw = await readFile(filePath, "utf-8");
      const parsed = matter(raw);
      out.push({
        path: filePath,
        name: entry.replace(/\.md$/, ""),
        frontmatter: (parsed.data ?? {}) as Record<string, unknown>,
      });
    } catch {
      // Unreadable file or malformed YAML — surface as a "missing
      // description" finding by pushing an empty frontmatter shell.
      out.push({
        path: filePath,
        name: entry.replace(/\.md$/, ""),
        frontmatter: {},
      });
    }
  }
  return out;
}

async function collectSkills(claudeHome: string): Promise<SkillEntry[]> {
  const dir = path.join(claudeHome, "skills");
  const out: SkillEntry[] = [];
  let entries: { name: string; isDirectory: () => boolean }[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillMdPath = path.join(dir, entry.name, "SKILL.md");
    try {
      const raw = await readFile(skillMdPath, "utf-8");
      const parsed = matter(raw);
      out.push({
        dirName: entry.name,
        skillMdPath,
        frontmatter: (parsed.data ?? {}) as Record<string, unknown>,
        lineCount: raw.split("\n").length,
      });
    } catch {
      out.push({
        dirName: entry.name,
        skillMdPath,
        frontmatter: null,
        lineCount: 0,
      });
    }
  }
  return out;
}

async function collectSettings(claudeHome: string): Promise<SettingsSnapshot> {
  const settingsPath = path.join(claudeHome, "settings.json");
  const result = await readJsonFile<Record<string, unknown>>(settingsPath);
  return {
    path: settingsPath,
    exists: result.data !== null,
    raw: result.data,
  };
}

async function collectUserClaudeMd(claudeHome: string): Promise<ClaudeMdFile> {
  const userPath = path.join(claudeHome, "CLAUDE.md");
  const result = await readMarkdownFile(userPath);
  if (result.data) {
    const content = result.data.content;
    return {
      path: userPath,
      exists: true,
      content,
      lineCount: content.split("\n").length,
    };
  }
  return { path: userPath, exists: false, content: "", lineCount: 0 };
}

export async function collectScanInputs(
  claudeHome: string,
): Promise<ScanInputs> {
  const [agents, skills, settings, userClaudeMd] = await Promise.all([
    collectAgents(claudeHome),
    collectSkills(claudeHome),
    collectSettings(claudeHome),
    collectUserClaudeMd(claudeHome),
  ]);
  return { agents, skills, settings, userClaudeMd };
}

/** Count individual hook commands across all events/groups in settings. */
function countHooks(settings: SettingsSnapshot): number {
  if (!settings.exists || !settings.raw) return 0;
  const hooksRaw = settings.raw.hooks;
  if (!isHookMap(hooksRaw)) return 0;
  let n = 0;
  for (const groups of Object.values(hooksRaw)) {
    for (const group of groups) {
      if (Array.isArray(group?.hooks)) n += group.hooks.length;
    }
  }
  return n;
}

/** How many distinct items each category actually evaluated. */
function countEvaluations(inputs: ScanInputs): Record<Category, number> {
  return {
    agents: inputs.agents.length,
    skills: inputs.skills.length,
    hooks: countHooks(inputs.settings),
    // Permissions has exactly one logical "item": the settings.json file
    // itself. If it doesn't exist we still emit `perm/no-settings`, so the
    // category is never silently n/a — see the score branch below.
    permissions: inputs.settings.exists ? 1 : 0,
    memory: inputs.userClaudeMd.exists ? 1 : 0,
  };
}

/**
 * Build the per-category scoreboard.
 *
 * - A category with `evaluated === 0` AND zero findings collapses to `null`
 *   ("n/a") so the UI doesn't show a misleading 100%.
 * - Otherwise it scores from 100, capped at 0.
 * - **Per-rule cap**: the same `ruleId` firing on N items only counts up
 *   to 3 hits toward the score. Without this cap, a category with many
 *   similar items (e.g. 20 agents that all skip the same optional field)
 *   collapses to 0, which is misleading — it's one configuration pattern,
 *   not 20 distinct problems. The full finding list is still surfaced
 *   in the UI; the cap only affects scoring.
 */
export function buildReport(
  inputs: ScanInputs,
  findings: Finding[],
  now: Date = new Date(),
): ScoreReport {
  const evaluatedByCategory = countEvaluations(inputs);

  const categories: CategoryScore[] = CATEGORIES.map((category) => {
    const catFindings = findings.filter((f) => f.category === category);
    const evaluated = evaluatedByCategory[category];

    if (evaluated === 0 && catFindings.length === 0) {
      return { category, score: null, evaluated, findings: [] };
    }

    const byRule = new Map<
      string,
      { severity: Finding["severity"]; count: number }
    >();
    for (const f of catFindings) {
      const existing = byRule.get(f.ruleId);
      if (existing) existing.count += 1;
      else byRule.set(f.ruleId, { severity: f.severity, count: 1 });
    }

    let score = 100;
    for (const { severity, count } of byRule.values()) {
      const hits = Math.min(count, 3);
      score -= SEVERITY_PENALTY[severity] * hits;
    }
    score = Math.max(0, Math.round(score));
    return { category, score, evaluated, findings: catFindings };
  });

  const scored = categories.filter((c) => c.score !== null);
  const overall =
    scored.length === 0
      ? null
      : Math.round(
          scored.reduce((sum, c) => sum + (c.score ?? 0), 0) / scored.length,
        );

  return {
    overall,
    categories,
    generatedAt: now.toISOString(),
  };
}

export async function runHarnessScore(
  claudeHome: string,
): Promise<ScoreReport> {
  const inputs = await collectScanInputs(claudeHome);
  const findings = evaluateAll(inputs);
  return buildReport(inputs, findings);
}
