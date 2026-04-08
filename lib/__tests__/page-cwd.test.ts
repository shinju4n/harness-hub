import { describe, it, expect } from "vitest";
import os from "os";
import path from "path";
import { resolvePageCwd } from "../page-cwd";

const HOME = os.homedir();
const CLAUDE = path.join(HOME, ".claude");

describe("resolvePageCwd", () => {
  it("returns ~/.claude/hooks for /hooks page", () => {
    expect(resolvePageCwd("/hooks")).toBe(path.join(CLAUDE, "hooks"));
  });

  it("returns ~/.claude/skills for /skills page", () => {
    expect(resolvePageCwd("/skills")).toBe(path.join(CLAUDE, "skills"));
  });

  it("returns ~/.claude/commands for /commands page", () => {
    expect(resolvePageCwd("/commands")).toBe(path.join(CLAUDE, "commands"));
  });

  it("returns ~/.claude/agents for /agents page", () => {
    expect(resolvePageCwd("/agents")).toBe(path.join(CLAUDE, "agents"));
  });

  it("returns ~/.claude/plugins for /plugins page", () => {
    expect(resolvePageCwd("/plugins")).toBe(path.join(CLAUDE, "plugins"));
  });

  it("returns ~/.claude for unknown pages", () => {
    expect(resolvePageCwd("/some-unknown-page")).toBe(CLAUDE);
  });

  it("returns ~/.claude for the dashboard /", () => {
    expect(resolvePageCwd("/")).toBe(CLAUDE);
  });

  it("matches nested routes by prefix (/hooks/foo → hooks)", () => {
    expect(resolvePageCwd("/hooks/some-script")).toBe(path.join(CLAUDE, "hooks"));
  });

  it("override takes precedence over pathname mapping", () => {
    expect(
      resolvePageCwd("/hooks", "/Users/me/projects/foo"),
    ).toBe("/Users/me/projects/foo");
  });

  it("override is ignored when null/undefined", () => {
    expect(resolvePageCwd("/hooks", null)).toBe(path.join(CLAUDE, "hooks"));
    expect(resolvePageCwd("/hooks", undefined)).toBe(path.join(CLAUDE, "hooks"));
  });
});
