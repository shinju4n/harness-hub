import type { Category, Severity } from "./types";

/**
 * **Single source of truth** for the rule catalog.
 *
 * Every rule the scoring engine emits MUST have an entry here. The
 * `defineFinding` helper in `rules.ts` only accepts `RuleId` (= the keys of
 * this object), so adding an unknown rule is a TypeScript compile error
 * rather than a runtime drift bug. The "How is this scored?" modal renders
 * straight from this object — there is no second source.
 *
 * Each rule cites the official Claude Code docs page that the rule derives
 * from. Anthropic doesn't publish a formal harness rubric, so every rule
 * must be traceable to a specific docs warning or recommendation.
 */
export interface RuleSpec {
  category: Category;
  severity: Severity;
  title: string;
  rationale: string;
  docsUrl: string;
}

const DOCS = {
  subAgents: "https://code.claude.com/docs/en/sub-agents",
  skills: "https://code.claude.com/docs/en/skills",
  hooks: "https://code.claude.com/docs/en/hooks",
  settings: "https://code.claude.com/docs/en/settings",
  permissions: "https://code.claude.com/docs/en/permissions",
  memory: "https://code.claude.com/docs/en/memory",
};

export const RULES = {
  // ---------- Agents ----------
  "agent/name-format": {
    category: "agents",
    severity: "warn",
    title: "Agent name uses lowercase + hyphens",
    rationale:
      "Sub-agent names must match [a-z0-9][a-z0-9-]* (no leading/lone hyphen). Mixed case breaks delegation lookups.",
    docsUrl: DOCS.subAgents,
  },
  "agent/description-missing": {
    category: "agents",
    severity: "error",
    title: "Agent has a description",
    rationale:
      "Claude uses each sub-agent's description to decide when to delegate. Missing descriptions are effectively dead agents.",
    docsUrl: DOCS.subAgents,
  },
  "agent/description-too-short": {
    category: "agents",
    severity: "warn",
    title: "Description is at least 20 characters",
    rationale:
      "Very short descriptions don't give Claude enough signal to choose the right agent.",
    docsUrl: DOCS.subAgents,
  },
  "agent/no-tool-whitelist": {
    category: "agents",
    severity: "info",
    title: "Tools are explicitly whitelisted",
    rationale:
      "Without `tools`, an agent inherits every tool from the parent — least-privilege is just a recommendation, so this is informational.",
    docsUrl: DOCS.subAgents,
  },
  "agent/bypass-permissions": {
    category: "agents",
    severity: "error",
    title: "permissionMode is not bypassPermissions",
    rationale:
      "Official docs warn this should only be used in isolated environments like containers or VMs.",
    docsUrl: DOCS.subAgents,
  },
  "agent/opus-on-readonly": {
    category: "agents",
    severity: "info",
    title: "Read-only agents don't use opus",
    rationale:
      "If an agent only uses Read/Grep/Glob, sonnet or haiku is usually sufficient and much cheaper.",
    docsUrl: DOCS.subAgents,
  },

  // ---------- Skills ----------
  "skill/missing-skill-md": {
    category: "skills",
    severity: "error",
    title: "Skill directory has SKILL.md",
    rationale:
      "A skill directory without SKILL.md cannot be loaded by Claude Code.",
    docsUrl: DOCS.skills,
  },
  "skill/description-missing": {
    category: "skills",
    severity: "warn",
    title: "Skill has a description",
    rationale:
      "The description is what Claude reads to decide when to apply a skill.",
    docsUrl: DOCS.skills,
  },
  "skill/description-too-long": {
    category: "skills",
    severity: "warn",
    title: "Description \u2264 250 characters",
    rationale:
      "Anything beyond 250 chars is truncated in the skills list, hiding the trigger condition.",
    docsUrl: DOCS.skills,
  },
  "skill/name-too-long": {
    category: "skills",
    severity: "warn",
    title: "Skill name \u2264 64 characters",
    rationale: "Official spec caps the name field at 64 characters.",
    docsUrl: DOCS.skills,
  },
  "skill/file-too-long": {
    category: "skills",
    severity: "info",
    title: "SKILL.md \u2264 500 lines",
    rationale:
      "Official tip: keep SKILL.md compact. Long files inflate context cost on every invocation.",
    docsUrl: DOCS.skills,
  },

  // ---------- Hooks ----------
  "hook/curl-pipe-shell": {
    category: "hooks",
    severity: "error",
    title: "No `curl ... | sh` in hook commands",
    rationale:
      "Piping a remote download into a shell is a classic supply-chain attack vector. Best-effort heuristic that catches curl/wget piped into sh/bash/zsh/python, including via sudo.",
    docsUrl: DOCS.hooks,
  },
  "hook/dangerous-bypass": {
    category: "hooks",
    severity: "error",
    title: "No --no-verify in hook commands",
    rationale:
      "Hooks that bypass commit/push safety checks defeat the harness's defensive layers.",
    docsUrl: DOCS.hooks,
  },
  "hook/no-timeout": {
    category: "hooks",
    severity: "info",
    title: "Network hooks declare a timeout",
    rationale:
      "A hook that calls curl/wget without a timeout can hang the entire turn.",
    docsUrl: DOCS.hooks,
  },

  // ---------- Permissions ----------
  "perm/no-settings": {
    category: "permissions",
    severity: "error",
    title: "settings.json exists",
    rationale:
      "With no settings.json, every tool runs unrestricted. The permission system can't protect you from a config that doesn't exist.",
    docsUrl: DOCS.settings,
  },
  "perm/missing-schema": {
    category: "permissions",
    severity: "info",
    title: "settings.json declares $schema",
    rationale:
      "Adding `$schema: https://json.schemastore.org/claude-code-settings.json` enables editor validation.",
    docsUrl: DOCS.settings,
  },
  "perm/bypass-default-mode": {
    category: "permissions",
    severity: "error",
    title: "permissions.defaultMode is not bypassPermissions",
    rationale:
      "Official Warning: only run with bypassPermissions inside containers/VMs.",
    docsUrl: DOCS.permissions,
  },
  "perm/bash-wildcard-allow": {
    category: "permissions",
    severity: "error",
    title: "Bash isn't allowed unconditionally",
    rationale:
      "`Bash`, `Bash(*)`, `Bash(**)`, or any whitespace/case variant in allow defeats the entire permission system.",
    docsUrl: DOCS.permissions,
  },
  "perm/curl-allow": {
    category: "permissions",
    severity: "warn",
    title: "No broad `Bash(curl ...)` allowlists",
    rationale:
      "Official Warning: curl allowlists are trivially bypassed by URL/option variants.",
    docsUrl: DOCS.permissions,
  },
  "perm/no-env-deny": {
    category: "permissions",
    severity: "error",
    title: ".env / secrets / credentials are denied",
    rationale:
      "permissions.deny should block at least one of: .env (as a path segment), secrets/, .aws/credentials. Otherwise the model can read them.",
    docsUrl: DOCS.permissions,
  },

  // ---------- Memory ----------
  "memory/no-claude-md": {
    category: "memory",
    severity: "warn",
    title: "Has a user-scope CLAUDE.md",
    rationale:
      "Without ~/.claude/CLAUDE.md, Claude has no persistent personal memory. Run /init in your project to bootstrap one.",
    docsUrl: DOCS.memory,
  },
  "memory/file-too-long": {
    category: "memory",
    severity: "warn",
    title: "CLAUDE.md \u2264 200 lines",
    rationale:
      "Official guidance: very long memory files inflate context cost and hurt instruction adherence.",
    docsUrl: DOCS.memory,
  },
  "memory/vague-instructions": {
    category: "memory",
    severity: "info",
    title: "Avoid vague directives",
    rationale:
      'Words like "properly", "correctly", "good code" give Claude no signal — replace with concrete rules.',
    docsUrl: DOCS.memory,
  },
} as const satisfies Record<string, RuleSpec>;

export type RuleId = keyof typeof RULES;

export const RULE_IDS = Object.keys(RULES) as RuleId[];
