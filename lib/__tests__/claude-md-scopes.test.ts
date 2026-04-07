import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  listClaudeMdScopes,
  readClaudeMdScope,
  writeClaudeMdScope,
} from "../claude-md-scopes";
import { writeFile, mkdir, rm, readFile } from "fs/promises";
import path from "path";
import os from "os";

describe("claude-md-scopes", () => {
  let tmpRoot: string;
  let claudeHome: string;
  let projectRoot: string;

  beforeEach(async () => {
    tmpRoot = path.join(os.tmpdir(), `harness-cmscopes-${Date.now()}-${Math.random()}`);
    claudeHome = path.join(tmpRoot, ".claude");
    projectRoot = path.join(tmpRoot, "my-project");
    await mkdir(claudeHome, { recursive: true });
    await mkdir(projectRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  describe("listClaudeMdScopes", () => {
    it("always returns all four scopes in fixed order", async () => {
      const scopes = await listClaudeMdScopes(claudeHome);
      expect(scopes.map((s) => s.id)).toEqual(["user", "project", "local", "org"]);
    });

    it("user scope is always available and writable", async () => {
      await writeFile(path.join(claudeHome, "CLAUDE.md"), "user content");
      const scopes = await listClaudeMdScopes(claudeHome);
      const user = scopes.find((s) => s.id === "user")!;
      expect(user.available).toBe(true);
      expect(user.exists).toBe(true);
      expect(user.writable).toBe(true);
      expect(user.filePath).toBe(path.join(claudeHome, "CLAUDE.md"));
    });

    it("project scope is unavailable when no projectRoot is supplied", async () => {
      const scopes = await listClaudeMdScopes(claudeHome);
      const proj = scopes.find((s) => s.id === "project")!;
      expect(proj.available).toBe(false);
      expect(proj.writable).toBe(false);
      expect(proj.filePath).toBe("");
      expect(proj.unavailableReason).toMatch(/project root/i);
    });

    it("local scope is unavailable when no projectRoot is supplied", async () => {
      const scopes = await listClaudeMdScopes(claudeHome);
      const local = scopes.find((s) => s.id === "local")!;
      expect(local.available).toBe(false);
      expect(local.writable).toBe(false);
    });

    it("project scope resolves to projectRoot/CLAUDE.md when projectRoot is supplied", async () => {
      await writeFile(path.join(projectRoot, "CLAUDE.md"), "project content");
      const scopes = await listClaudeMdScopes(claudeHome, { projectRoot });
      const proj = scopes.find((s) => s.id === "project")!;
      expect(proj.available).toBe(true);
      expect(proj.exists).toBe(true);
      expect(proj.writable).toBe(true);
      expect(proj.filePath).toBe(path.join(projectRoot, "CLAUDE.md"));
    });

    it("local scope resolves to projectRoot/CLAUDE.local.md when projectRoot is supplied", async () => {
      await writeFile(path.join(projectRoot, "CLAUDE.local.md"), "local content");
      const scopes = await listClaudeMdScopes(claudeHome, { projectRoot });
      const local = scopes.find((s) => s.id === "local")!;
      expect(local.available).toBe(true);
      expect(local.filePath).toBe(path.join(projectRoot, "CLAUDE.local.md"));
    });

    it("rejects a projectRoot that does not exist or is not a directory", async () => {
      const scopes = await listClaudeMdScopes(claudeHome, {
        projectRoot: path.join(tmpRoot, "nope"),
      });
      const proj = scopes.find((s) => s.id === "project")!;
      expect(proj.available).toBe(false);
      expect(proj.unavailableReason).toMatch(/not found|not a directory/i);
    });

    it("rejects a non-absolute projectRoot", async () => {
      const scopes = await listClaudeMdScopes(claudeHome, { projectRoot: "relative/path" });
      const proj = scopes.find((s) => s.id === "project")!;
      expect(proj.available).toBe(false);
      expect(proj.unavailableReason).toMatch(/absolute/i);
    });

    it("org scope is always read-only and available", async () => {
      const scopes = await listClaudeMdScopes(claudeHome);
      const org = scopes.find((s) => s.id === "org")!;
      expect(org.available).toBe(true);
      expect(org.writable).toBe(false);
    });
  });

  describe("readClaudeMdScope", () => {
    it("reads user scope content", async () => {
      await writeFile(path.join(claudeHome, "CLAUDE.md"), "hello");
      const result = await readClaudeMdScope(claudeHome, "user");
      expect(result.content).toBe("hello");
      expect(result.exists).toBe(true);
    });

    it("returns empty when user file missing", async () => {
      const result = await readClaudeMdScope(claudeHome, "user");
      expect(result.content).toBe("");
      expect(result.exists).toBe(false);
    });

    it("refuses project scope without projectRoot", async () => {
      await expect(readClaudeMdScope(claudeHome, "project")).rejects.toThrow(/project root/i);
    });

    it("reads project scope when projectRoot provided", async () => {
      await writeFile(path.join(projectRoot, "CLAUDE.md"), "proj");
      const result = await readClaudeMdScope(claudeHome, "project", { projectRoot });
      expect(result.content).toBe("proj");
    });

    it("throws on unknown scope id", async () => {
      await expect(readClaudeMdScope(claudeHome, "bogus" as never)).rejects.toThrow();
    });
  });

  describe("writeClaudeMdScope", () => {
    it("writes user scope", async () => {
      await writeClaudeMdScope(claudeHome, "user", "new");
      const raw = await readFile(path.join(claudeHome, "CLAUDE.md"), "utf-8");
      expect(raw).toBe("new");
    });

    it("rejects writes to org scope", async () => {
      await expect(writeClaudeMdScope(claudeHome, "org", "x")).rejects.toThrow(/read-only/i);
    });

    it("refuses project writes without projectRoot", async () => {
      await expect(writeClaudeMdScope(claudeHome, "project", "p")).rejects.toThrow(/project root/i);
    });

    it("writes project scope when projectRoot supplied", async () => {
      await writeClaudeMdScope(claudeHome, "project", "p", { projectRoot });
      const raw = await readFile(path.join(projectRoot, "CLAUDE.md"), "utf-8");
      expect(raw).toBe("p");
    });

    it("writes local scope when projectRoot supplied", async () => {
      await writeClaudeMdScope(claudeHome, "local", "l", { projectRoot });
      const raw = await readFile(path.join(projectRoot, "CLAUDE.local.md"), "utf-8");
      expect(raw).toBe("l");
    });
  });
});
