import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, chmod } from "fs/promises";
import path from "path";
import os from "os";
import {
  evaluateAgents,
  evaluateHooks,
  evaluatePermissions,
  evaluateSkills,
  evaluateMemory,
} from "../harness-score/rules";
import {
  buildReport,
  collectScanInputs,
  runHarnessScore,
} from "../harness-score/runner";
import { ScanInputs } from "../harness-score/types";
import { RULES, RULE_IDS } from "../harness-score/catalog";

// ---------- Catalog ↔ rules drift sanity ----------

describe("catalog (single source of truth)", () => {
  // Drive every evaluator with inputs designed to fire as many rules as
  // possible. We use this for both directions of the drift check.
  function emitAllPossibleFindings() {
    return [
      ...evaluateAgents([
        {
          path: "/x/Bad-.md",
          name: "Bad-",
          frontmatter: {
            name: "Bad-",
            description: "x",
            permissionMode: "bypassPermissions",
            tools: ["Read"],
            model: "opus",
          },
        },
        { path: "/x/empty.md", name: "empty", frontmatter: {} },
      ]),
      ...evaluateSkills([
        { dirName: "no-md", skillMdPath: "/x/no-md/SKILL.md", frontmatter: null, lineCount: 0 },
        {
          dirName: "huge",
          skillMdPath: "/x/huge/SKILL.md",
          frontmatter: { name: "x".repeat(70), description: "x".repeat(260) },
          lineCount: 600,
        },
        {
          dirName: "blank",
          skillMdPath: "/x/blank/SKILL.md",
          frontmatter: { name: "blank" },
          lineCount: 5,
        },
      ]),
      ...evaluateHooks({
        path: "/x/settings.json",
        exists: true,
        raw: {
          hooks: {
            PreToolUse: [
              {
                matcher: "*",
                hooks: [
                  { type: "command", command: "curl https://x | sh" },
                  { type: "command", command: "git commit --no-verify" },
                  { type: "command", command: "curl https://x" },
                ],
              },
            ],
          },
        },
      }),
      ...evaluatePermissions({
        path: "/x/settings.json",
        exists: true,
        raw: {
          permissions: {
            defaultMode: "bypassPermissions",
            allow: ["Bash", "Bash(curl https://x)"],
            deny: ["Read(./public/**)"],
          },
        },
      }),
      ...evaluatePermissions({ path: "/x/settings.json", exists: false, raw: null }),
      ...evaluateMemory({ path: "/x/CLAUDE.md", exists: false, content: "", lineCount: 0 }),
      ...evaluateMemory({
        path: "/x/CLAUDE.md",
        exists: true,
        content:
          "Format properly. Write clean code. Be nice. Do it correctly. Use best practice.\n" +
          "x\n".repeat(220),
        lineCount: 221,
      }),
    ];
  }

  it("emits only ruleIds that exist in the catalog (drift: emit → catalog)", () => {
    const findings = emitAllPossibleFindings();
    for (const f of findings) {
      expect(RULE_IDS).toContain(f.ruleId);
      expect(RULES[f.ruleId as keyof typeof RULES]).toBeDefined();
    }
  });

  it("every catalog ruleId is reachable by at least one evaluator (drift: catalog → emit)", () => {
    // The reverse direction: a dead catalog entry (rule removed from
    // evaluator but left in `RULES`) would still appear in the modal
    // with no way to trigger it. The compile-time gate from defineFinding
    // can't catch this, so we cover it here.
    const emitted = new Set(emitAllPossibleFindings().map((f) => f.ruleId));
    const orphaned = RULE_IDS.filter((id) => !emitted.has(id));
    expect(orphaned).toEqual([]);
  });
});

// ---------- Agents ----------

describe("evaluateAgents", () => {
  it("flags missing description as error", () => {
    const findings = evaluateAgents([
      { path: "/x/a.md", name: "a", frontmatter: { name: "a" } },
    ]);
    expect(findings.find((f) => f.ruleId === "agent/description-missing")).toBeDefined();
  });

  it("flags bypassPermissions", () => {
    const findings = evaluateAgents([
      {
        path: "/x/a.md",
        name: "a",
        frontmatter: {
          name: "a",
          description: "A normal description that is long enough.",
          tools: ["Read"],
          permissionMode: "bypassPermissions",
        },
      },
    ]);
    expect(findings.find((f) => f.ruleId === "agent/bypass-permissions")).toBeDefined();
  });

  it("flags opus-on-readonly", () => {
    const findings = evaluateAgents([
      {
        path: "/x/a.md",
        name: "explorer",
        frontmatter: {
          name: "explorer",
          description: "Reads files and reports findings to the parent agent.",
          tools: ["Read", "Grep", "Glob"],
          model: "opus",
        },
      },
    ]);
    expect(findings.find((f) => f.ruleId === "agent/opus-on-readonly")).toBeDefined();
  });

  it("clean agent has no findings", () => {
    const findings = evaluateAgents([
      {
        path: "/x/a.md",
        name: "reviewer",
        frontmatter: {
          name: "reviewer",
          description: "Use this agent after writing code to perform a thorough code review.",
          tools: ["Read", "Grep"],
          model: "sonnet",
        },
      },
    ]);
    expect(findings).toHaveLength(0);
  });

  it("flags uppercase agent name", () => {
    const findings = evaluateAgents([
      {
        path: "/x/Bad.md",
        name: "Bad",
        frontmatter: {
          name: "Bad",
          description: "An agent with a name containing uppercase letters.",
          tools: ["Read"],
        },
      },
    ]);
    expect(findings.find((f) => f.ruleId === "agent/name-format")).toBeDefined();
  });

  it("flags lone-hyphen and leading-hyphen names", () => {
    const lone = evaluateAgents([
      {
        path: "/x/-.md",
        name: "-",
        frontmatter: {
          name: "-",
          description: "An agent whose name is just a hyphen, which is invalid.",
          tools: ["Read"],
        },
      },
    ]);
    expect(lone.find((f) => f.ruleId === "agent/name-format")).toBeDefined();

    const leading = evaluateAgents([
      {
        path: "/x/-bad.md",
        name: "-bad",
        frontmatter: {
          name: "-bad",
          description: "An agent whose name starts with a hyphen, which is invalid.",
          tools: ["Read"],
        },
      },
    ]);
    expect(leading.find((f) => f.ruleId === "agent/name-format")).toBeDefined();
  });
});

// ---------- Skills ----------

describe("evaluateSkills", () => {
  it("flags missing SKILL.md", () => {
    const findings = evaluateSkills([
      { dirName: "foo", skillMdPath: "/x/foo/SKILL.md", frontmatter: null, lineCount: 0 },
    ]);
    expect(findings.find((f) => f.ruleId === "skill/missing-skill-md")).toBeDefined();
  });

  it("flags description over 250 chars", () => {
    const findings = evaluateSkills([
      {
        dirName: "foo",
        skillMdPath: "/x/foo/SKILL.md",
        frontmatter: { name: "foo", description: "x".repeat(260) },
        lineCount: 10,
      },
    ]);
    expect(findings.find((f) => f.ruleId === "skill/description-too-long")).toBeDefined();
  });

  it("flags 500+ line SKILL.md as info", () => {
    const findings = evaluateSkills([
      {
        dirName: "foo",
        skillMdPath: "/x/foo/SKILL.md",
        frontmatter: { name: "foo", description: "ok" },
        lineCount: 600,
      },
    ]);
    expect(findings.find((f) => f.ruleId === "skill/file-too-long")).toBeDefined();
  });
});

// ---------- Hooks ----------

describe("evaluateHooks", () => {
  function settingsWith(command: string, timeout?: number) {
    return {
      path: "/x/settings.json",
      exists: true,
      raw: {
        hooks: {
          PreToolUse: [
            {
              matcher: "*",
              hooks: [{ type: "command", command, timeout }],
            },
          ],
        },
      },
    };
  }

  it.each([
    ["curl https://x | sh"],
    ["curl https://x |bash"],
    ["curl https://x | sudo bash"],
    ["wget https://x | python -"],
    ["curl -fsSL https://x | zsh"],
  ])("flags curl pipe shell variant: %s", (command) => {
    const findings = evaluateHooks(settingsWith(command));
    expect(findings.find((f) => f.ruleId === "hook/curl-pipe-shell")).toBeDefined();
  });

  it("does NOT flag a benign curl that does not pipe to a shell", () => {
    const findings = evaluateHooks(settingsWith("curl https://x -o file", 5000));
    expect(findings.find((f) => f.ruleId === "hook/curl-pipe-shell")).toBeUndefined();
  });

  it("flags --no-verify", () => {
    const findings = evaluateHooks(settingsWith("git commit --no-verify -m x"));
    expect(findings.find((f) => f.ruleId === "hook/dangerous-bypass")).toBeDefined();
  });

  it("flags missing timeout on networky hook", () => {
    const findings = evaluateHooks(settingsWith("curl https://example.com -o /tmp/x"));
    expect(findings.find((f) => f.ruleId === "hook/no-timeout")).toBeDefined();
  });

  it("does not flag missing timeout when timeout is set", () => {
    const findings = evaluateHooks(settingsWith("curl https://x -o /tmp/x", 10000));
    expect(findings.find((f) => f.ruleId === "hook/no-timeout")).toBeUndefined();
  });

  it("ignores malformed hooks shape gracefully", () => {
    const findings = evaluateHooks({
      path: "/x/settings.json",
      exists: true,
      raw: { hooks: "not an object" },
    });
    expect(findings).toHaveLength(0);
  });
});

// ---------- Permissions ----------

describe("evaluatePermissions", () => {
  it("emits perm/no-settings (error) when settings missing", () => {
    const findings = evaluatePermissions({ path: "/x/settings.json", exists: false, raw: null });
    const f = findings.find((x) => x.ruleId === "perm/no-settings");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("error");
  });

  it("flags missing $schema, missing env deny, bash wildcard, bypass mode, curl allow", () => {
    const findings = evaluatePermissions({
      path: "/x/settings.json",
      exists: true,
      raw: {
        permissions: {
          defaultMode: "bypassPermissions",
          allow: ["Bash", "Bash(curl https://x)"],
          deny: ["Read(./public/**)"],
        },
      },
    });
    const ids = new Set(findings.map((f) => f.ruleId));
    expect(ids.has("perm/missing-schema")).toBe(true);
    expect(ids.has("perm/bypass-default-mode")).toBe(true);
    expect(ids.has("perm/bash-wildcard-allow")).toBe(true);
    expect(ids.has("perm/curl-allow")).toBe(true);
    expect(ids.has("perm/no-env-deny")).toBe(true);
  });

  it("Bash wildcard variants are caught", () => {
    const cases = ["Bash", "bash", "Bash(*)", "Bash( * )", "Bash(**)", "Bash(*:*)"];
    for (const variant of cases) {
      const findings = evaluatePermissions({
        path: "/x/settings.json",
        exists: true,
        raw: {
          $schema: "x",
          permissions: { allow: [variant], deny: ["Read(./.env)"] },
        },
      });
      expect(
        findings.find((f) => f.ruleId === "perm/bash-wildcard-allow"),
        `expected match for ${variant}`,
      ).toBeDefined();
    }
  });

  it("scoped Bash allowlists do NOT trip the wildcard rule", () => {
    const findings = evaluatePermissions({
      path: "/x/settings.json",
      exists: true,
      raw: {
        $schema: "x",
        permissions: {
          allow: ["Bash(npm run lint)", "Bash(pnpm test)"],
          deny: ["Read(./.env)"],
        },
      },
    });
    expect(findings.find((f) => f.ruleId === "perm/bash-wildcard-allow")).toBeUndefined();
  });

  it("perm/no-env-deny is NOT satisfied by .environment-overrides false-positive", () => {
    const findings = evaluatePermissions({
      path: "/x/settings.json",
      exists: true,
      raw: {
        $schema: "x",
        permissions: {
          allow: [],
          deny: ["Read(./.environment-overrides)"],
        },
      },
    });
    expect(findings.find((f) => f.ruleId === "perm/no-env-deny")).toBeDefined();
  });

  it("perm/no-env-deny is NOT satisfied by Read(./events/**)", () => {
    const findings = evaluatePermissions({
      path: "/x/settings.json",
      exists: true,
      raw: {
        $schema: "x",
        permissions: { allow: [], deny: ["Read(./events/**)"] },
      },
    });
    expect(findings.find((f) => f.ruleId === "perm/no-env-deny")).toBeDefined();
  });

  it("accepts Read(./.env), Read(./.env.local), Read(./secrets/**), Read(~/.aws/credentials)", () => {
    for (const deny of [
      "Read(./.env)",
      "Read(./.env.local)",
      "Read(./secrets/**)",
      "Read(~/.aws/credentials)",
    ]) {
      const findings = evaluatePermissions({
        path: "/x/settings.json",
        exists: true,
        raw: { $schema: "x", permissions: { allow: [], deny: [deny] } },
      });
      expect(
        findings.find((f) => f.ruleId === "perm/no-env-deny"),
        `expected ${deny} to satisfy the env deny rule`,
      ).toBeUndefined();
    }
  });

  it("clean settings produce no findings", () => {
    const findings = evaluatePermissions({
      path: "/x/settings.json",
      exists: true,
      raw: {
        $schema: "https://json.schemastore.org/claude-code-settings.json",
        permissions: {
          allow: ["Bash(npm run lint)"],
          deny: ["Read(./.env)", "Read(./secrets/**)"],
        },
      },
    });
    expect(findings).toHaveLength(0);
  });
});

// ---------- Memory ----------

describe("evaluateMemory", () => {
  it("flags missing user-scope CLAUDE.md", () => {
    const findings = evaluateMemory({
      path: "/x/CLAUDE.md",
      exists: false,
      content: "",
      lineCount: 0,
    });
    expect(findings.find((f) => f.ruleId === "memory/no-claude-md")).toBeDefined();
  });

  it("flags >200-line CLAUDE.md", () => {
    const findings = evaluateMemory({
      path: "/x/CLAUDE.md",
      exists: true,
      content: "x\n".repeat(220),
      lineCount: 220,
    });
    expect(findings.find((f) => f.ruleId === "memory/file-too-long")).toBeDefined();
  });

  it("flags vague instructions", () => {
    const findings = evaluateMemory({
      path: "/x/CLAUDE.md",
      exists: true,
      content:
        "Format properly. Write clean code. Be nice. Do it correctly. Use best practice.",
      lineCount: 1,
    });
    expect(findings.find((f) => f.ruleId === "memory/vague-instructions")).toBeDefined();
  });
});

// ---------- Aggregation ----------

describe("buildReport", () => {
  const baseInputs: ScanInputs = {
    agents: [],
    skills: [],
    settings: { path: "/x/settings.json", exists: true, raw: {} },
    userClaudeMd: { path: "/x/CLAUDE.md", exists: false, content: "", lineCount: 0 },
  };

  it("returns null score for empty categories with no findings", () => {
    const report = buildReport(baseInputs, []);
    const agents = report.categories.find((c) => c.category === "agents")!;
    expect(agents.score).toBeNull();
  });

  it("computes overall as average of scored categories", () => {
    const inputs: ScanInputs = {
      ...baseInputs,
      agents: [{ path: "/x/a.md", name: "a", frontmatter: { name: "a" } }],
    };
    const findings = [
      {
        ruleId: "agent/description-missing",
        category: "agents" as const,
        severity: "error" as const,
        message: "x",
        docsUrl: "https://example.com",
      },
    ];
    const report = buildReport(inputs, findings);
    const agents = report.categories.find((c) => c.category === "agents")!;
    expect(agents.score).toBe(85);
    expect(report.overall).not.toBeNull();
  });

  it("caps repeated findings of the same ruleId at 3 hits", () => {
    const inputs: ScanInputs = {
      ...baseInputs,
      agents: Array.from({ length: 20 }).map((_, i) => ({
        path: `/x/${i}.md`,
        name: `a${i}`,
        frontmatter: {},
      })),
    };
    const findings = Array.from({ length: 20 }).map((_, i) => ({
      ruleId: "agent/description-missing",
      category: "agents" as const,
      severity: "error" as const,
      message: `x${i}`,
      docsUrl: "https://example.com",
    }));
    const report = buildReport(inputs, findings);
    expect(report.categories.find((c) => c.category === "agents")!.score).toBe(55);
  });

  it("clamps score to 0 when many distinct rules fire", () => {
    const inputs: ScanInputs = {
      ...baseInputs,
      agents: [{ path: "/x/a.md", name: "a", frontmatter: {} }],
    };
    const errors = Array.from({ length: 20 }).map((_, i) => ({
      ruleId: `x/${i}`,
      category: "agents" as const,
      severity: "error" as const,
      message: "x",
      docsUrl: "https://example.com",
    }));
    const report = buildReport(inputs, errors);
    expect(report.categories.find((c) => c.category === "agents")!.score).toBe(0);
  });

  it("returns null overall when no findings exist and no items were evaluated", () => {
    // Pure builder unit test: regardless of what the runner *would* do for
    // a real fresh install, when both `evaluated` and `findings` are empty
    // for every category, overall must collapse to null.
    const empty: ScanInputs = {
      agents: [],
      skills: [],
      settings: { path: "/x/settings.json", exists: false, raw: null },
      userClaudeMd: { path: "/x/CLAUDE.md", exists: false, content: "", lineCount: 0 },
    };
    const report = buildReport(empty, []);
    expect(report.overall).toBeNull();
    for (const c of report.categories) {
      expect(c.score).toBeNull();
    }
  });
});

// ---------- Runner / I/O ----------

describe("runHarnessScore (integration)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = path.join(
      os.tmpdir(),
      `harness-score-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(path.join(tmp, "agents"), { recursive: true });
    await mkdir(path.join(tmp, "skills", "foo"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("scans a real directory and returns a report", async () => {
    await writeFile(
      path.join(tmp, "agents", "tester.md"),
      `---\nname: tester\ndescription: Use this when running tests after writing code\ntools:\n  - Read\n  - Bash\nmodel: sonnet\n---\nbody`,
    );
    await writeFile(
      path.join(tmp, "skills", "foo", "SKILL.md"),
      `---\nname: foo\ndescription: A demo skill that demonstrates a thing\n---\nbody`,
    );
    await writeFile(
      path.join(tmp, "settings.json"),
      JSON.stringify({
        $schema: "https://json.schemastore.org/claude-code-settings.json",
        permissions: {
          allow: ["Bash(npm test)"],
          deny: ["Read(./.env)"],
        },
        hooks: {},
      }),
    );
    await writeFile(path.join(tmp, "CLAUDE.md"), "# header\nUse 2-space indent.\n");

    const inputs = await collectScanInputs(tmp);
    expect(inputs.agents).toHaveLength(1);
    expect(inputs.skills).toHaveLength(1);
    expect(inputs.settings.exists).toBe(true);
    expect(inputs.userClaudeMd.exists).toBe(true);

    const report = await runHarnessScore(tmp);
    expect(report.overall).not.toBeNull();
    expect(report.categories.find((c) => c.category === "permissions")!.score).toBe(100);
  });

  it("treats malformed YAML in agent files as empty frontmatter shells", async () => {
    // gray-matter throws on a frontmatter block that opens but never closes.
    await writeFile(
      path.join(tmp, "agents", "broken.md"),
      "---\nname: broken\n  invalid: [unclosed\n",
    );

    const inputs = await collectScanInputs(tmp);
    const broken = inputs.agents.find((a) => a.name === "broken");
    expect(broken).toBeDefined();
    expect(broken!.frontmatter).toEqual({});
  });

  it("scores a real fresh install: settings + CLAUDE.md missing but other categories n/a", async () => {
    // Truly empty harness home — just an empty dir, no agents/skills/
    // settings/CLAUDE.md. Permissions fires `perm/no-settings` (error, -15
    // → 85) and memory fires `memory/no-claude-md` (warn, -7 → 93). The
    // other three categories collapse to n/a; overall = round((85+93)/2)
    // = 89.
    const fresh = path.join(
      os.tmpdir(),
      `harness-score-fresh-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(fresh, { recursive: true });
    try {
      const report = await runHarnessScore(fresh);
      const perm = report.categories.find((c) => c.category === "permissions")!;
      const memory = report.categories.find((c) => c.category === "memory")!;
      const agents = report.categories.find((c) => c.category === "agents")!;

      expect(perm.score).toBe(85);
      expect(memory.score).toBe(93);
      expect(agents.score).toBeNull();
      expect(report.overall).toBe(89);

      const ids = new Set(perm.findings.map((f) => f.ruleId));
      expect(ids.has("perm/no-settings")).toBe(true);
    } finally {
      await rm(fresh, { recursive: true, force: true });
    }
  });

  it("returns empty agents/skills lists when directories are unreadable", async () => {
    // Make agents/ unreadable then try to scan. Skipped on platforms where
    // chmod doesn't restrict reads (e.g. running as root).
    const agentsDir = path.join(tmp, "agents");
    try {
      await chmod(agentsDir, 0o000);
      const inputs = await collectScanInputs(tmp);
      expect(inputs.agents).toEqual([]);
    } finally {
      await chmod(agentsDir, 0o755).catch(() => undefined);
    }
  });
});
