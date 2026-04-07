import { describe, it, expect, vi, afterEach } from "vitest";
import { getClaudeHome, detectClaudeInstallation } from "../claude-home";
import os from "os";
import path from "path";

describe("getClaudeHome", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns CLAUDE_HOME env if set", () => {
    vi.stubEnv("CLAUDE_HOME", "/custom/path");
    expect(getClaudeHome()).toBe("/custom/path");
  });

  it("falls back to HOME/.claude on posix", () => {
    vi.stubEnv("CLAUDE_HOME", "");
    vi.stubEnv("HOME", "/Users/test");
    expect(getClaudeHome()).toBe("/Users/test/.claude");
  });

  describe("override validation (trust boundary for request headers)", () => {
    it("accepts an override inside the user's home directory", () => {
      const home = os.homedir();
      const override = path.join(home, ".claude");
      expect(() => getClaudeHome(override)).not.toThrow();
    });

    it("accepts an override inside os.tmpdir() (used by tests)", () => {
      const override = path.join(os.tmpdir(), "harness-fake", ".claude");
      expect(() => getClaudeHome(override)).not.toThrow();
    });

    it("rejects an override outside the user's home (path traversal defense)", () => {
      expect(() => getClaudeHome("/etc/passwd")).toThrow(/outside/i);
      expect(() => getClaudeHome("/var/root/.claude")).toThrow(/outside/i);
    });

    it("rejects an override pointing at a system directory via .claude suffix", () => {
      expect(() => getClaudeHome("/Library/Application Support/ClaudeCode/.claude")).toThrow(/outside/i);
    });

    it("rejects a non-absolute override", () => {
      expect(() => getClaudeHome("relative/path")).toThrow();
    });

    it("rejects null byte injection", () => {
      expect(() => getClaudeHome("/Users/test/.claude\u0000/../../etc")).toThrow();
    });
  });
});

describe("detectClaudeInstallation", () => {
  it("returns exists: false for non-existent path", async () => {
    const result = await detectClaudeInstallation("/nonexistent/path/.claude");
    expect(result.exists).toBe(false);
  });
});
