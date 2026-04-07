import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { listClaudeMdScopes, readClaudeMdScope, writeClaudeMdScope } from "../claude-md-scopes";
import { writeFile, mkdir, rm, readFile } from "fs/promises";
import path from "path";
import os from "os";

describe("claude-md-scopes", () => {
  let tmpRoot: string;
  let claudeHome: string;

  beforeEach(async () => {
    tmpRoot = path.join(os.tmpdir(), `harness-cmscopes-${Date.now()}-${Math.random()}`);
    claudeHome = path.join(tmpRoot, ".claude");
    await mkdir(claudeHome, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  describe("listClaudeMdScopes", () => {
    it("always returns all four scopes with fixed order", async () => {
      const scopes = await listClaudeMdScopes(claudeHome);
      expect(scopes.map((s) => s.id)).toEqual(["user", "project", "local", "org"]);
    });

    it("marks user scope as existing when file present", async () => {
      await writeFile(path.join(claudeHome, "CLAUDE.md"), "user content");
      const scopes = await listClaudeMdScopes(claudeHome);
      const user = scopes.find((s) => s.id === "user")!;
      expect(user.exists).toBe(true);
      expect(user.writable).toBe(true);
      expect(user.filePath).toBe(path.join(claudeHome, "CLAUDE.md"));
    });

    it("project scope resolves to parent of claudeHome", async () => {
      await writeFile(path.join(tmpRoot, "CLAUDE.md"), "project content");
      const scopes = await listClaudeMdScopes(claudeHome);
      const proj = scopes.find((s) => s.id === "project")!;
      expect(proj.exists).toBe(true);
      expect(proj.filePath).toBe(path.join(tmpRoot, "CLAUDE.md"));
    });

    it("local scope resolves to parent/CLAUDE.local.md", async () => {
      await writeFile(path.join(tmpRoot, "CLAUDE.local.md"), "local content");
      const scopes = await listClaudeMdScopes(claudeHome);
      const local = scopes.find((s) => s.id === "local")!;
      expect(local.exists).toBe(true);
      expect(local.filePath).toBe(path.join(tmpRoot, "CLAUDE.local.md"));
    });

    it("org scope is always read-only", async () => {
      const scopes = await listClaudeMdScopes(claudeHome);
      const org = scopes.find((s) => s.id === "org")!;
      expect(org.writable).toBe(false);
    });

    it("returns exists=false with valid filePath when user CLAUDE.md missing", async () => {
      const scopes = await listClaudeMdScopes(claudeHome);
      const user = scopes.find((s) => s.id === "user")!;
      expect(user.exists).toBe(false);
      expect(user.filePath).toBe(path.join(claudeHome, "CLAUDE.md"));
    });
  });

  describe("readClaudeMdScope", () => {
    it("returns file content for existing scope", async () => {
      await writeFile(path.join(claudeHome, "CLAUDE.md"), "hello");
      const result = await readClaudeMdScope(claudeHome, "user");
      expect(result.content).toBe("hello");
      expect(result.exists).toBe(true);
    });

    it("returns empty content when scope file missing", async () => {
      const result = await readClaudeMdScope(claudeHome, "user");
      expect(result.content).toBe("");
      expect(result.exists).toBe(false);
    });

    it("throws for unknown scope id", async () => {
      await expect(readClaudeMdScope(claudeHome, "bogus" as never)).rejects.toThrow();
    });
  });

  describe("writeClaudeMdScope", () => {
    it("writes user scope content", async () => {
      await writeClaudeMdScope(claudeHome, "user", "new content");
      const raw = await readFile(path.join(claudeHome, "CLAUDE.md"), "utf-8");
      expect(raw).toBe("new content");
    });

    it("rejects writes to org scope (read-only)", async () => {
      await expect(writeClaudeMdScope(claudeHome, "org", "x")).rejects.toThrow(/read-only/i);
    });

    it("writes project scope to parent dir", async () => {
      await writeClaudeMdScope(claudeHome, "project", "proj");
      const raw = await readFile(path.join(tmpRoot, "CLAUDE.md"), "utf-8");
      expect(raw).toBe("proj");
    });
  });
});
