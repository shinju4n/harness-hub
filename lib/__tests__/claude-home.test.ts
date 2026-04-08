import { describe, it, expect, vi, afterEach } from "vitest";
import { getClaudeHome, detectClaudeInstallation } from "../claude-home";
import os from "os";
import path from "path";

describe("getClaudeHome", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns CLAUDE_HOME env if set to an absolute path", () => {
    const safe = path.join(os.homedir(), ".claude-test");
    vi.stubEnv("CLAUDE_HOME", safe);
    expect(getClaudeHome()).toBe(safe);
  });

  it("rejects CLAUDE_HOME env with a relative path", () => {
    vi.stubEnv("CLAUDE_HOME", "relative");
    expect(() => getClaudeHome()).toThrow();
  });

  it("treats whitespace-only CLAUDE_HOME as unset (falls back to HOME/.claude)", () => {
    vi.stubEnv("CLAUDE_HOME", "   ");
    vi.stubEnv("HOME", "/Users/test");
    expect(getClaudeHome()).toBe("/Users/test/.claude");
  });

  it("falls back to HOME/.claude on posix", () => {
    vi.stubEnv("CLAUDE_HOME", "");
    vi.stubEnv("HOME", "/Users/test");
    expect(getClaudeHome()).toBe("/Users/test/.claude");
  });

  describe("override hygiene (single-user desktop threat model)", () => {
    it("accepts an override inside the user's home directory", () => {
      const home = os.homedir();
      const override = path.join(home, ".claude");
      expect(() => getClaudeHome(override)).not.toThrow();
    });

    it("accepts an override inside os.tmpdir() (used by tests)", () => {
      const override = path.join(os.tmpdir(), "harness-fake", ".claude");
      expect(() => getClaudeHome(override)).not.toThrow();
    });

    it("accepts an override on an external drive / mount point", () => {
      // The point of relaxing validation: paths outside $HOME like external
      // drives, NAS mounts, and cloud-sync folders are now allowed.
      expect(() => getClaudeHome("/Volumes/Work/.claude")).not.toThrow();
      expect(() => getClaudeHome("/mnt/data/.claude")).not.toThrow();
      expect(() => getClaudeHome("/nonexistent/.claude")).not.toThrow();
    });

    it("rejects a non-absolute override", () => {
      expect(() => getClaudeHome("relative/path")).toThrow();
    });

    it("rejects an empty override (after trim)", () => {
      // "auto" is the explicit "use default" sentinel, but a blank string
      // should still be a hard error to surface UI bugs early.
      expect(() => getClaudeHome("   ")).toThrow();
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
