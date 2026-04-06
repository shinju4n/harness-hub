import { describe, it, expect, vi, afterEach } from "vitest";
import { getClaudeHome, detectClaudeInstallation } from "../claude-home";

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
});

describe("detectClaudeInstallation", () => {
  it("returns exists: false for non-existent path", async () => {
    const result = await detectClaudeInstallation("/nonexistent/path/.claude");
    expect(result.exists).toBe(false);
  });
});
