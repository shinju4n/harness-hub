import { describe, it, expect, vi, afterEach } from "vitest";
import { getClaudeHome, detectClaudeInstallation } from "../claude-home";
import os from "os";
import path from "path";

describe("getClaudeHome", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns CLAUDE_HOME env if set and inside an allowed base", () => {
    const safe = path.join(os.homedir(), ".claude-test");
    vi.stubEnv("CLAUDE_HOME", safe);
    expect(getClaudeHome()).toBe(safe);
  });

  it("rejects CLAUDE_HOME env pointing at a system path", () => {
    vi.stubEnv("CLAUDE_HOME", "/etc");
    expect(() => getClaudeHome()).toThrow(/outside/i);
  });

  it("rejects CLAUDE_HOME env with a relative path", () => {
    vi.stubEnv("CLAUDE_HOME", "relative");
    expect(() => getClaudeHome()).toThrow();
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

    it("parses HARNESS_HUB_ALLOWED_HOMES using the platform path delimiter", () => {
      // On posix: `:` — on win32: `;`. Use the real delimiter so the test
      // actually exercises the parsing path on the host platform.
      const extra = path.join(os.tmpdir(), "custom-base");
      vi.stubEnv("HARNESS_HUB_ALLOWED_HOMES", extra);
      const override = path.join(extra, ".claude");
      expect(() => getClaudeHome(override)).not.toThrow();
    });
  });
});

describe("detectClaudeInstallation", () => {
  it("returns exists: false for non-existent path", async () => {
    const result = await detectClaudeInstallation("/nonexistent/path/.claude");
    expect(result.exists).toBe(false);
  });
});
