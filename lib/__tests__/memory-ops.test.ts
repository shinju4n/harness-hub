import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  listMemoryProjects,
  listMemoryFiles,
  readMemoryFile,
  createMemoryFile,
  updateMemoryFile,
  deleteMemoryFile,
  buildMemoryFileContent,
} from "../memory-ops";
import { writeFile, mkdir, rm, readFile, stat } from "fs/promises";
import path from "path";
import os from "os";

describe("memory-ops", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `harness-hub-memory-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ─── Read Functions ───

  describe("listMemoryProjects", () => {
    it("returns empty array if projects dir doesn't exist", async () => {
      const result = await listMemoryProjects(tmpDir);
      expect(result).toEqual([]);
    });

    it("lists projects with memory dirs", async () => {
      const projDir = path.join(tmpDir, "projects", "my-project", "memory");
      await mkdir(projDir, { recursive: true });
      await writeFile(path.join(projDir, "MEMORY.md"), "# Memory Index");
      await writeFile(path.join(projDir, "note1.md"), "---\nname: Note 1\n---\nbody");
      await writeFile(path.join(projDir, "note2.md"), "---\nname: Note 2\n---\nbody");

      const result = await listMemoryProjects(tmpDir);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("my-project");
      expect(result[0].hasMemoryDir).toBe(true);
      expect(result[0].memoryCount).toBe(2); // excludes MEMORY.md
    });

    it("includes projects without memory dir (hasMemoryDir=false)", async () => {
      await mkdir(path.join(tmpDir, "projects", "no-memory"), { recursive: true });

      const result = await listMemoryProjects(tmpDir);
      expect(result).toHaveLength(1);
      expect(result[0].hasMemoryDir).toBe(false);
      expect(result[0].memoryCount).toBe(0);
    });

    it("handles multiple projects", async () => {
      await mkdir(path.join(tmpDir, "projects", "proj-a", "memory"), { recursive: true });
      await writeFile(path.join(tmpDir, "projects", "proj-a", "memory", "file.md"), "content");
      await mkdir(path.join(tmpDir, "projects", "proj-b"), { recursive: true });

      const result = await listMemoryProjects(tmpDir);
      expect(result).toHaveLength(2);
      const projA = result.find((p) => p.id === "proj-a");
      const projB = result.find((p) => p.id === "proj-b");
      expect(projA?.hasMemoryDir).toBe(true);
      expect(projA?.memoryCount).toBe(1);
      expect(projB?.hasMemoryDir).toBe(false);
    });
  });

  describe("listMemoryFiles", () => {
    it("returns memories and memoryIndex", async () => {
      const memDir = path.join(tmpDir, "projects", "proj", "memory");
      await mkdir(memDir, { recursive: true });
      await writeFile(
        path.join(memDir, "MEMORY.md"),
        "- [Note](note.md) — A note"
      );
      await writeFile(
        path.join(memDir, "note.md"),
        "---\nname: Note\ndescription: A note\ntype: user\n---\n\nNote body"
      );

      const result = await listMemoryFiles(tmpDir, "proj");
      expect(result.memoryIndex).toBe("- [Note](note.md) — A note");
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].fileName).toBe("note.md");
      expect(result.memories[0].name).toBe("Note");
      expect(result.memories[0].description).toBe("A note");
      expect(result.memories[0].type).toBe("user");
      expect(result.memories[0].body).toContain("Note body");
    });

    it("handles files without frontmatter", async () => {
      const memDir = path.join(tmpDir, "projects", "proj", "memory");
      await mkdir(memDir, { recursive: true });
      await writeFile(path.join(memDir, "raw.md"), "Just plain text");

      const result = await listMemoryFiles(tmpDir, "proj");
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].name).toBeNull();
      expect(result.memories[0].description).toBeNull();
      expect(result.memories[0].type).toBe("unknown");
    });

    it("returns null memoryIndex if MEMORY.md doesn't exist", async () => {
      const memDir = path.join(tmpDir, "projects", "proj", "memory");
      await mkdir(memDir, { recursive: true });
      await writeFile(path.join(memDir, "note.md"), "content");

      const result = await listMemoryFiles(tmpDir, "proj");
      expect(result.memoryIndex).toBeNull();
    });

    it("returns empty result if memory dir doesn't exist", async () => {
      await mkdir(path.join(tmpDir, "projects", "proj"), { recursive: true });
      const result = await listMemoryFiles(tmpDir, "proj");
      expect(result.memories).toEqual([]);
      expect(result.memoryIndex).toBeNull();
    });
  });

  describe("readMemoryFile", () => {
    it("reads a single memory file with parsed data", async () => {
      const memDir = path.join(tmpDir, "projects", "proj", "memory");
      await mkdir(memDir, { recursive: true });
      await writeFile(
        path.join(memDir, "note.md"),
        "---\nname: My Note\ndescription: Desc\ntype: feedback\n---\n\nBody here"
      );

      const result = await readMemoryFile(tmpDir, "proj", "note.md");
      expect(result).not.toBeNull();
      expect(result!.fileName).toBe("note.md");
      expect(result!.name).toBe("My Note");
      expect(result!.description).toBe("Desc");
      expect(result!.type).toBe("feedback");
      expect(result!.body).toContain("Body here");
      expect(result!.mtime).toBeDefined();
    });

    it("returns null if file doesn't exist", async () => {
      const result = await readMemoryFile(tmpDir, "proj", "missing.md");
      expect(result).toBeNull();
    });
  });

  // ─── Write Functions ───

  describe("buildMemoryFileContent", () => {
    it("builds frontmatter + body content", () => {
      const content = buildMemoryFileContent({
        name: "Test",
        description: "A test file",
        type: "user",
        body: "Hello world",
      });
      expect(content).toContain("---");
      expect(content).toContain("name: Test");
      expect(content).toContain("description: A test file");
      expect(content).toContain("type: user");
      expect(content).toContain("Hello world");
    });
  });

  describe("createMemoryFile", () => {
    it("creates a new memory file and updates MEMORY.md", async () => {
      const projDir = path.join(tmpDir, "projects", "proj");
      await mkdir(projDir, { recursive: true });

      const result = await createMemoryFile(tmpDir, "proj", {
        fileName: "note.md",
        name: "Note",
        description: "A note",
        type: "user",
        body: "Body content",
      });

      expect(result.success).toBe(true);

      // File should exist
      const memDir = path.join(projDir, "memory");
      const fileContent = await readFile(path.join(memDir, "note.md"), "utf-8");
      expect(fileContent).toContain("name: Note");
      expect(fileContent).toContain("Body content");

      // MEMORY.md should have entry
      const indexContent = await readFile(path.join(memDir, "MEMORY.md"), "utf-8");
      expect(indexContent).toContain("[Note](note.md)");
      expect(indexContent).toContain("A note");
    });

    it("creates memory dir and MEMORY.md if they don't exist", async () => {
      await mkdir(path.join(tmpDir, "projects", "proj"), { recursive: true });

      const result = await createMemoryFile(tmpDir, "proj", {
        fileName: "first.md",
        name: "First",
        description: "First file",
        type: "project",
        body: "Content",
      });

      expect(result.success).toBe(true);
      const memDir = path.join(tmpDir, "projects", "proj", "memory");
      const indexExists = await stat(path.join(memDir, "MEMORY.md"))
        .then(() => true)
        .catch(() => false);
      expect(indexExists).toBe(true);
    });

    it("returns 409 error if file already exists", async () => {
      const memDir = path.join(tmpDir, "projects", "proj", "memory");
      await mkdir(memDir, { recursive: true });
      await writeFile(path.join(memDir, "existing.md"), "content");

      const result = await createMemoryFile(tmpDir, "proj", {
        fileName: "existing.md",
        name: "Existing",
        description: "Already here",
        type: "user",
        body: "Body",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });

    it("warns if MEMORY.md exceeds 180 lines", async () => {
      const memDir = path.join(tmpDir, "projects", "proj", "memory");
      await mkdir(memDir, { recursive: true });
      const longIndex = Array.from({ length: 181 }, (_, i) => `- line ${i}`).join("\n");
      await writeFile(path.join(memDir, "MEMORY.md"), longIndex);

      const result = await createMemoryFile(tmpDir, "proj", {
        fileName: "new.md",
        name: "New",
        description: "Desc",
        type: "user",
        body: "Body",
      });

      expect(result.success).toBe(true);
      expect(result.warning).toContain("180");
    });
  });

  describe("updateMemoryFile", () => {
    it("updates file content and MEMORY.md entry", async () => {
      const memDir = path.join(tmpDir, "projects", "proj", "memory");
      await mkdir(memDir, { recursive: true });
      await writeFile(
        path.join(memDir, "note.md"),
        "---\nname: Old\ndescription: Old desc\ntype: user\n---\n\nOld body"
      );
      await writeFile(
        path.join(memDir, "MEMORY.md"),
        "- [Old](note.md) — Old desc\n"
      );

      const fileStat = await stat(path.join(memDir, "note.md"));

      const result = await updateMemoryFile(tmpDir, "proj", {
        fileName: "note.md",
        name: "New",
        description: "New desc",
        type: "user",
        body: "New body",
        expectedMtime: fileStat.mtimeMs,
      });

      expect(result.success).toBe(true);

      const updated = await readFile(path.join(memDir, "note.md"), "utf-8");
      expect(updated).toContain("name: New");
      expect(updated).toContain("New body");

      const index = await readFile(path.join(memDir, "MEMORY.md"), "utf-8");
      expect(index).toContain("[New](note.md) — New desc");
      expect(index).not.toContain("Old");
    });

    it("rejects on mtime conflict", async () => {
      const memDir = path.join(tmpDir, "projects", "proj", "memory");
      await mkdir(memDir, { recursive: true });
      await writeFile(path.join(memDir, "note.md"), "content");

      const result = await updateMemoryFile(tmpDir, "proj", {
        fileName: "note.md",
        name: "New",
        description: "Desc",
        type: "user",
        body: "Body",
        expectedMtime: 0, // wrong mtime
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("conflict");
    });

    it("appends to MEMORY.md if entry not found", async () => {
      const memDir = path.join(tmpDir, "projects", "proj", "memory");
      await mkdir(memDir, { recursive: true });
      await writeFile(
        path.join(memDir, "note.md"),
        "---\nname: Note\n---\nbody"
      );
      await writeFile(path.join(memDir, "MEMORY.md"), "# Memory Index\n");

      const fileStat = await stat(path.join(memDir, "note.md"));

      const result = await updateMemoryFile(tmpDir, "proj", {
        fileName: "note.md",
        name: "Note",
        description: "Desc",
        type: "user",
        body: "Body",
        expectedMtime: fileStat.mtimeMs,
      });

      expect(result.success).toBe(true);
      const index = await readFile(path.join(memDir, "MEMORY.md"), "utf-8");
      expect(index).toContain("[Note](note.md) — Desc");
    });
  });

  describe("deleteMemoryFile", () => {
    it("deletes the file and removes MEMORY.md entry", async () => {
      const memDir = path.join(tmpDir, "projects", "proj", "memory");
      await mkdir(memDir, { recursive: true });
      await writeFile(path.join(memDir, "note.md"), "content");
      await writeFile(
        path.join(memDir, "MEMORY.md"),
        "- [Note](note.md) — A note\n- [Other](other.md) — Keep this\n"
      );

      const result = await deleteMemoryFile(tmpDir, "proj", "note.md");
      expect(result.success).toBe(true);

      // File should be gone
      const exists = await stat(path.join(memDir, "note.md"))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);

      // MEMORY.md should not have the entry
      const index = await readFile(path.join(memDir, "MEMORY.md"), "utf-8");
      expect(index).not.toContain("note.md");
      expect(index).toContain("other.md");
    });

    it("deletes file even if no MEMORY.md entry matches", async () => {
      const memDir = path.join(tmpDir, "projects", "proj", "memory");
      await mkdir(memDir, { recursive: true });
      await writeFile(path.join(memDir, "orphan.md"), "content");
      await writeFile(path.join(memDir, "MEMORY.md"), "# Index\n");

      const result = await deleteMemoryFile(tmpDir, "proj", "orphan.md");
      expect(result.success).toBe(true);
    });

    it("succeeds even if MEMORY.md doesn't exist", async () => {
      const memDir = path.join(tmpDir, "projects", "proj", "memory");
      await mkdir(memDir, { recursive: true });
      await writeFile(path.join(memDir, "note.md"), "content");

      const result = await deleteMemoryFile(tmpDir, "proj", "note.md");
      expect(result.success).toBe(true);
    });

    it("returns error if file doesn't exist", async () => {
      const memDir = path.join(tmpDir, "projects", "proj", "memory");
      await mkdir(memDir, { recursive: true });

      const result = await deleteMemoryFile(tmpDir, "proj", "missing.md");
      expect(result.success).toBe(false);
    });
  });
});
