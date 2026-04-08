import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";
import { resolveClaudeHome, resolveTerminalCwd } from "../cwd-resolver";

const HOME = os.homedir();
const DEFAULT_CLAUDE = path.join(HOME, ".claude");

describe("resolveClaudeHome", () => {
  it('returns default for "auto"', () => {
    expect(resolveClaudeHome("auto")).toBe(DEFAULT_CLAUDE);
  });

  it("returns default for null", () => {
    expect(resolveClaudeHome(null)).toBe(DEFAULT_CLAUDE);
  });

  it("returns default for undefined", () => {
    expect(resolveClaudeHome(undefined)).toBe(DEFAULT_CLAUDE);
  });

  it("returns default for empty string", () => {
    expect(resolveClaudeHome("")).toBe(DEFAULT_CLAUDE);
  });

  it("returns absolute path ending in .claude as-is", () => {
    expect(resolveClaudeHome("/Users/me/work/.claude")).toBe("/Users/me/work/.claude");
  });

  it("returns default for non-absolute paths", () => {
    expect(resolveClaudeHome("relative/path")).toBe(DEFAULT_CLAUDE);
  });

  it("returns path that does not exist but is absolute, not ending in .claude, as-is", () => {
    // The path doesn't contain a .claude subdir, so we return it unchanged —
    // createDefaultPtyFactory's load-bearing existsSync fallback then drops
    // the shell into the user's home if the final cwd is missing.
    expect(resolveClaudeHome("/nonexistent/path")).toBe("/nonexistent/path");
  });

  it("rejects NUL bytes and falls back to default", () => {
    expect(resolveClaudeHome("/Users/me/\0evil")).toBe(DEFAULT_CLAUDE);
  });

  it("rejects path traversal and falls back to default", () => {
    expect(resolveClaudeHome("/Users/me/../../etc")).toBe(DEFAULT_CLAUDE);
    expect(resolveClaudeHome("/Users/me/work/../escape")).toBe(DEFAULT_CLAUDE);
  });

  describe("with a real .claude subdir on disk", () => {
    const tmpParent = fs.mkdtempSync(path.join(os.tmpdir(), "cwd-resolver-"));
    const claudeSubdir = path.join(tmpParent, ".claude");

    beforeAll(() => {
      fs.mkdirSync(claudeSubdir, { recursive: true });
    });

    afterAll(() => {
      fs.rmSync(tmpParent, { recursive: true, force: true });
    });

    it("appends .claude when parent directory has it as a subdir", () => {
      expect(resolveClaudeHome(tmpParent)).toBe(claudeSubdir);
    });
  });
});

describe("resolveTerminalCwd", () => {
  const CLAUDE = "/Users/ju4n/.claude";

  it("returns claudeHome for /", () => {
    expect(resolveTerminalCwd(CLAUDE, "/")).toBe(CLAUDE);
  });

  it("maps /hooks to <claudeHome>/hooks", () => {
    expect(resolveTerminalCwd(CLAUDE, "/hooks")).toBe(path.join(CLAUDE, "hooks"));
  });

  it("maps /skills to <claudeHome>/skills", () => {
    expect(resolveTerminalCwd(CLAUDE, "/skills")).toBe(path.join(CLAUDE, "skills"));
  });

  it("maps /commands to <claudeHome>/commands", () => {
    expect(resolveTerminalCwd(CLAUDE, "/commands")).toBe(path.join(CLAUDE, "commands"));
  });

  it("maps /agents to <claudeHome>/agents", () => {
    expect(resolveTerminalCwd(CLAUDE, "/agents")).toBe(path.join(CLAUDE, "agents"));
  });

  it("maps /plugins to <claudeHome>/plugins", () => {
    expect(resolveTerminalCwd(CLAUDE, "/plugins")).toBe(path.join(CLAUDE, "plugins"));
  });

  it("maps /memory to <claudeHome>/memory", () => {
    expect(resolveTerminalCwd(CLAUDE, "/memory")).toBe(path.join(CLAUDE, "memory"));
  });

  it("maps nested /hooks/foo to <claudeHome>/hooks by first segment", () => {
    expect(resolveTerminalCwd(CLAUDE, "/hooks/some-script")).toBe(path.join(CLAUDE, "hooks"));
  });

  it("falls back to claudeHome for unknown pages", () => {
    expect(resolveTerminalCwd(CLAUDE, "/some-unknown-page")).toBe(CLAUDE);
  });

  it("respects custom claudeHome base for mapped pages", () => {
    expect(resolveTerminalCwd("/tmp/alt/.claude", "/agents")).toBe(path.join("/tmp/alt/.claude", "agents"));
  });
});
