import { RULES, RuleId } from "./catalog";
import {
  AgentFile,
  ClaudeMdFile,
  Finding,
  isHookMap,
  RawHookGroup,
  ScanInputs,
  SettingsSnapshot,
  SkillEntry,
} from "./types";

/**
 * Pure rule evaluators. Each function takes parsed inputs and returns the
 * findings it discovered. No I/O — the runner handles file reads, then
 * hands everything here. This keeps unit tests trivial.
 *
 * Drift safety: every finding is created via `defineFinding(id, ...)`, where
 * `id` is constrained to `RuleId` (= keys of the catalog). A typo or stale
 * rule ID is a TypeScript compile error, not a runtime drift bug, so the
 * catalog is structurally the single source of truth.
 */

const READ_ONLY_TOOLS = new Set(["Read", "Grep", "Glob", "WebFetch"]);

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function defineFinding(
  id: RuleId,
  message: string,
  target?: string,
): Finding {
  const spec = RULES[id];
  return {
    ruleId: id,
    category: spec.category,
    severity: spec.severity,
    message,
    docsUrl: spec.docsUrl,
    target,
  };
}

// ---------- Agents ----------

/** Sub-agent name spec: starts with [a-z0-9], rest may include hyphens. */
const AGENT_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

export function evaluateAgents(agents: AgentFile[]): Finding[] {
  const out: Finding[] = [];
  for (const agent of agents) {
    const fm = agent.frontmatter ?? {};
    const name = asString(fm.name) ?? agent.name;
    const description = asString(fm.description);
    const tools = fm.tools;
    const permissionMode = asString(fm.permissionMode);
    const model = asString(fm.model);

    if (!AGENT_NAME_RE.test(name)) {
      out.push(
        defineFinding(
          "agent/name-format",
          `Agent name "${name}" should start with a letter/digit and contain only lowercase letters, digits, and hyphens.`,
          agent.path,
        ),
      );
    }

    if (!description || description.trim().length === 0) {
      out.push(
        defineFinding(
          "agent/description-missing",
          `Agent "${name}" has no description. Claude uses descriptions to decide when to delegate.`,
          agent.path,
        ),
      );
    } else if (description.trim().length < 20) {
      out.push(
        defineFinding(
          "agent/description-too-short",
          `Agent "${name}" description is very short (${description.trim().length} chars). Add a clear "use this when…" sentence.`,
          agent.path,
        ),
      );
    }

    if (tools === undefined || tools === null) {
      out.push(
        defineFinding(
          "agent/no-tool-whitelist",
          `Agent "${name}" has no tools whitelist — it inherits every tool from the parent. Specify tools to apply least-privilege.`,
          agent.path,
        ),
      );
    }

    if (permissionMode === "bypassPermissions") {
      out.push(
        defineFinding(
          "agent/bypass-permissions",
          `Agent "${name}" sets permissionMode: bypassPermissions. Official docs warn this should only be used in isolated environments.`,
          agent.path,
        ),
      );
    }

    if (model === "opus" && Array.isArray(tools)) {
      const all = tools.every(
        (t) => typeof t === "string" && READ_ONLY_TOOLS.has(t),
      );
      if (all && tools.length > 0) {
        out.push(
          defineFinding(
            "agent/opus-on-readonly",
            `Agent "${name}" uses opus but only read-only tools — sonnet or haiku is usually enough.`,
            agent.path,
          ),
        );
      }
    }
  }
  return out;
}

// ---------- Skills ----------

export function evaluateSkills(skills: SkillEntry[]): Finding[] {
  const out: Finding[] = [];
  for (const skill of skills) {
    if (skill.frontmatter === null) {
      out.push(
        defineFinding(
          "skill/missing-skill-md",
          `Skill "${skill.dirName}" has no SKILL.md file.`,
          skill.skillMdPath,
        ),
      );
      continue;
    }

    const fm = skill.frontmatter;
    const name = asString(fm.name) ?? skill.dirName;
    const description = asString(fm.description);

    if (!description || description.trim().length === 0) {
      out.push(
        defineFinding(
          "skill/description-missing",
          `Skill "${name}" has no description. Claude uses it to decide when to apply the skill.`,
          skill.skillMdPath,
        ),
      );
    } else if (description.length > 250) {
      out.push(
        defineFinding(
          "skill/description-too-long",
          `Skill "${name}" description is ${description.length} chars — anything over 250 is truncated in the skills list.`,
          skill.skillMdPath,
        ),
      );
    }

    if (name.length > 64) {
      out.push(
        defineFinding(
          "skill/name-too-long",
          `Skill "${name}" name exceeds 64 characters.`,
          skill.skillMdPath,
        ),
      );
    }

    if (skill.lineCount > 500) {
      out.push(
        defineFinding(
          "skill/file-too-long",
          `SKILL.md for "${name}" is ${skill.lineCount} lines — official guidance recommends staying under 500.`,
          skill.skillMdPath,
        ),
      );
    }
  }
  return out;
}

// ---------- Hooks ----------

/**
 * Best-effort heuristic for "downloads piped into a shell". Catches:
 *   curl URL | sh
 *   curl URL |bash       (no space)
 *   curl URL | sudo bash (sudo wrapper)
 *   wget URL | python -  (interpreter shells)
 * Anchored on a downloader followed by `|` followed by an interpreter.
 */
const CURL_PIPE_SHELL_RE =
  /\b(?:curl|wget|fetch)\b[^|;\n]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|ksh|dash|fish|python\d?|node|ruby|perl|php)\b/i;

const NETWORK_CALL_RE = /\b(?:curl|wget|fetch)\b/i;

export function evaluateHooks(settings: SettingsSnapshot): Finding[] {
  if (!settings.exists || !settings.raw) return [];
  const out: Finding[] = [];
  const hooksRaw = settings.raw.hooks;
  if (!isHookMap(hooksRaw)) return out;

  for (const [event, groups] of Object.entries(hooksRaw)) {
    for (const group of groups) {
      const list: RawHookGroup["hooks"] = Array.isArray(group?.hooks)
        ? group.hooks
        : [];
      for (const hook of list) {
        const command = asString(hook?.command) ?? "";
        const target = `${event} ${group?.matcher ?? "*"}`;

        if (CURL_PIPE_SHELL_RE.test(command)) {
          out.push(
            defineFinding(
              "hook/curl-pipe-shell",
              `Hook in ${target} pipes a remote download into an interpreter — this is a classic supply-chain risk.`,
              target,
            ),
          );
        }

        if (/--no-verify\b/.test(command)) {
          out.push(
            defineFinding(
              "hook/dangerous-bypass",
              `Hook in ${target} uses --no-verify, bypassing repo safety checks.`,
              target,
            ),
          );
        }

        if (NETWORK_CALL_RE.test(command) && hook?.timeout === undefined) {
          out.push(
            defineFinding(
              "hook/no-timeout",
              `Hook in ${target} performs a network call without an explicit timeout.`,
              target,
            ),
          );
        }
      }
    }
  }
  return out;
}

// ---------- Permissions ----------

/**
 * Strict matcher for `Read(<path>)` deny entries that protect a secret file
 * or directory. We require:
 *   - the wrapping action is Read (case-insensitive)
 *   - the path matches one of the segment patterns below as an actual
 *     path segment (i.e. `.env` not as a substring inside `.environment`)
 */
const SECRET_SEGMENT_RES = [
  // .env (with optional .local/.production etc.) but NOT .environment
  /(^|\/)\.env(\.[a-z0-9]+)?(\/|$|\*)/i,
  // secrets/ directory
  /(^|\/)secrets(\/|$)/i,
  // .aws/credentials
  /(^|\/)\.aws\/credentials(\/|$)/i,
];

function looksLikeSecretDeny(entry: string): boolean {
  const m = /^\s*Read\s*\(\s*([^)]+?)\s*\)\s*$/i.exec(entry);
  if (!m) return false;
  const innerPath = m[1].replace(/^\.\//, "");
  return SECRET_SEGMENT_RES.some((re) => re.test(innerPath));
}

/**
 * Bash wildcard allow detection. Matches:
 *   Bash         bash         BASH
 *   Bash(*)      Bash( * )    Bash(**)     Bash(*:*)
 * but NOT scoped allowlists like Bash(npm test) or Bash(curl https://x).
 */
const BASH_WILDCARD_RE = /^\s*bash\s*(?:\(\s*\*+\s*(?::\s*\*+\s*)?\))?\s*$/i;

export function evaluatePermissions(settings: SettingsSnapshot): Finding[] {
  if (!settings.exists || !settings.raw) {
    return [
      defineFinding(
        "perm/no-settings",
        "settings.json is missing — no permission rules to enforce.",
      ),
    ];
  }
  const out: Finding[] = [];
  const raw = settings.raw;
  const permissionsValue = raw.permissions;
  const permissions: Record<string, unknown> =
    permissionsValue && typeof permissionsValue === "object" && !Array.isArray(permissionsValue)
      ? (permissionsValue as Record<string, unknown>)
      : {};
  const allow = asArray(permissions.allow) ?? [];
  const deny = asArray(permissions.deny) ?? [];
  const defaultMode = asString(permissions.defaultMode);

  if (!raw.$schema) {
    out.push(
      defineFinding(
        "perm/missing-schema",
        "settings.json has no $schema — adding json.schemastore.org/claude-code-settings.json enables editor validation.",
        settings.path,
      ),
    );
  }

  if (defaultMode === "bypassPermissions") {
    out.push(
      defineFinding(
        "perm/bypass-default-mode",
        "permissions.defaultMode is bypassPermissions — official docs warn this should only run in containers/VMs.",
        settings.path,
      ),
    );
  }

  for (const entry of allow) {
    const s = asString(entry) ?? "";
    if (BASH_WILDCARD_RE.test(s)) {
      out.push(
        defineFinding(
          "perm/bash-wildcard-allow",
          `permissions.allow contains "${s}" — granting unrestricted Bash defeats the permission system.`,
          settings.path,
        ),
      );
    }
    if (/^\s*Bash\s*\(\s*curl\b/i.test(s)) {
      out.push(
        defineFinding(
          "perm/curl-allow",
          `permissions.allow contains "${s}" — official docs warn that curl allowlists are easy to bypass.`,
          settings.path,
        ),
      );
    }
  }

  const denyStrings = deny.map((d) => asString(d) ?? "");
  const hasSecretDeny = denyStrings.some(looksLikeSecretDeny);
  if (!hasSecretDeny) {
    out.push(
      defineFinding(
        "perm/no-env-deny",
        "permissions.deny does not block .env, secrets/, or .aws/credentials. Add Read deny rules to keep secrets out of the model context.",
        settings.path,
      ),
    );
  }

  return out;
}

// ---------- Memory / CLAUDE.md ----------

const VAGUE_WORDS =
  /\b(properly|correctly|appropriately|good|nice|clean code|best practice)\b/gi;

export function evaluateMemory(file: ClaudeMdFile): Finding[] {
  const out: Finding[] = [];
  if (!file.exists) {
    out.push(
      defineFinding(
        "memory/no-claude-md",
        "No user-scope CLAUDE.md found at ~/.claude/CLAUDE.md. Run /init in your project to bootstrap one.",
      ),
    );
    return out;
  }

  if (file.lineCount > 200) {
    out.push(
      defineFinding(
        "memory/file-too-long",
        `CLAUDE.md is ${file.lineCount} lines — official guidance recommends staying under 200.`,
        file.path,
      ),
    );
  }

  const matches = file.content.match(VAGUE_WORDS);
  if (matches && matches.length >= 5) {
    out.push(
      defineFinding(
        "memory/vague-instructions",
        `CLAUDE.md contains ${matches.length} vague directives ("properly", "correctly", "good"...). Replace with concrete rules.`,
        file.path,
      ),
    );
  }

  return out;
}

// ---------- Aggregation ----------

export function evaluateAll(inputs: ScanInputs): Finding[] {
  return [
    ...evaluateAgents(inputs.agents),
    ...evaluateSkills(inputs.skills),
    ...evaluateHooks(inputs.settings),
    ...evaluatePermissions(inputs.settings),
    ...evaluateMemory(inputs.userClaudeMd),
  ];
}
