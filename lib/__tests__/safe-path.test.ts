import { describe, it, expect, vi, afterEach } from "vitest";
import os from "os";
import path from "path";

describe("safe-path", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe("web mode", () => {
    it("blocks system paths", async () => {
      vi.stubEnv("HARNESS_HUB_MODE", "web");
      vi.stubEnv("CLAUDE_HOME", path.join(os.homedir(), ".claude"));

      const { assertWithinClaudeHome, PathConfinementError } = await import(
        "../safe-path"
      );

      for (const sysPath of ["/etc", "/etc/passwd", "/proc/1", "/sys/fs", "/dev/null", "/root", "/boot/vmlinuz", "/sbin/init"]) {
        expect(() => assertWithinClaudeHome(sysPath)).toThrow(
          PathConfinementError
        );
      }
    });

    it("blocks paths outside CLAUDE_HOME", async () => {
      vi.stubEnv("HARNESS_HUB_MODE", "web");
      vi.stubEnv("CLAUDE_HOME", path.join(os.homedir(), ".claude"));

      const { assertWithinClaudeHome, PathConfinementError } = await import(
        "../safe-path"
      );

      expect(() => assertWithinClaudeHome("/tmp/evil")).toThrow(
        PathConfinementError
      );
    });

    it("allows paths within CLAUDE_HOME", async () => {
      const claudeHome = path.join(os.homedir(), ".claude");
      vi.stubEnv("HARNESS_HUB_MODE", "web");
      vi.stubEnv("CLAUDE_HOME", claudeHome);

      const { assertWithinClaudeHome } = await import("../safe-path");

      expect(() =>
        assertWithinClaudeHome(path.join(claudeHome, "settings.json"))
      ).not.toThrow();
    });

    it("allows the CLAUDE_HOME directory itself", async () => {
      const claudeHome = path.join(os.homedir(), ".claude");
      vi.stubEnv("HARNESS_HUB_MODE", "web");
      vi.stubEnv("CLAUDE_HOME", claudeHome);

      const { assertWithinClaudeHome } = await import("../safe-path");

      expect(() => assertWithinClaudeHome(claudeHome)).not.toThrow();
    });
  });

  describe("desktop mode (no-op)", () => {
    it("allows any path in desktop mode", async () => {
      vi.stubEnv("HARNESS_HUB_MODE", "desktop");

      const { assertWithinClaudeHome } = await import("../safe-path");

      expect(() => assertWithinClaudeHome("/etc/passwd")).not.toThrow();
      expect(() => assertWithinClaudeHome("/Volumes/Work/.claude")).not.toThrow();
    });

    it("allows any path when HARNESS_HUB_MODE is unset", async () => {
      vi.stubEnv("HARNESS_HUB_MODE", "");

      const { assertWithinClaudeHome } = await import("../safe-path");

      expect(() => assertWithinClaudeHome("/etc/passwd")).not.toThrow();
    });
  });
});
