export type Severity = "error" | "warn" | "info";

export type Category =
  | "agents"
  | "skills"
  | "hooks"
  | "permissions"
  | "memory";

export const SEVERITY_PENALTY: Record<Severity, number> = {
  error: 15,
  warn: 7,
  info: 3,
};

export interface Finding {
  ruleId: string;
  category: Category;
  severity: Severity;
  message: string;
  target?: string;
  docsUrl: string;
}

export interface CategoryScore {
  category: Category;
  score: number | null;
  evaluated: number;
  findings: Finding[];
}

export interface ScoreReport {
  overall: number | null;
  categories: CategoryScore[];
  generatedAt: string;
}

/** Raw inputs collected by the runner — kept plain so rules stay pure. */
export interface ScanInputs {
  agents: AgentFile[];
  skills: SkillEntry[];
  settings: SettingsSnapshot;
  /**
   * User-scope CLAUDE.md only. Harness Hub has no concept of "the current
   * project" — that lives in the user's editor session, not in the desktop
   * app — so we deliberately don't try to score project-scope CLAUDE.md.
   */
  userClaudeMd: ClaudeMdFile;
}

export interface AgentFile {
  path: string;
  name: string;
  frontmatter: Record<string, unknown>;
}

export interface SkillEntry {
  /** directory name (used as fallback for `name`) */
  dirName: string;
  /** absolute path to the SKILL.md file we expected */
  skillMdPath: string;
  /** null when SKILL.md is missing */
  frontmatter: Record<string, unknown> | null;
  lineCount: number;
}

export interface SettingsSnapshot {
  path: string;
  exists: boolean;
  raw: Record<string, unknown> | null;
}

export interface ClaudeMdFile {
  path: string;
  exists: boolean;
  content: string;
  lineCount: number;
}

/** Shape of a single hook entry inside `settings.json` → `hooks[event][i].hooks[j]`. */
export interface RawHook {
  type?: string;
  command?: string;
  timeout?: number;
}

/** Shape of a hook group inside `settings.json` → `hooks[event][i]`. */
export interface RawHookGroup {
  matcher?: string;
  hooks?: RawHook[];
}

/** Type guard: confirms `value` is shaped like `Record<string, RawHookGroup[]>`. */
export function isHookMap(
  value: unknown,
): value is Record<string, RawHookGroup[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  for (const groups of Object.values(value as Record<string, unknown>)) {
    if (!Array.isArray(groups)) return false;
  }
  return true;
}
