import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readJsonFile, writeJsonFile, readMarkdownFile } from "../file-ops";
import { writeFile, mkdir, rm, stat } from "fs/promises";
import path from "path";
import os from "os";

describe("file-ops", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `harness-hub-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("readJsonFile", () => {
    it("reads and parses valid JSON", async () => {
      const filePath = path.join(tmpDir, "test.json");
      await writeFile(filePath, '{"key": "value"}');
      const result = await readJsonFile(filePath);
      expect(result.data).toEqual({ key: "value" });
      expect(result.error).toBeUndefined();
    });

    it("returns error for missing file", async () => {
      const result = await readJsonFile(path.join(tmpDir, "missing.json"));
      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe("writeJsonFile", () => {
    it("writes JSON with backup", async () => {
      const filePath = path.join(tmpDir, "write.json");
      await writeFile(filePath, '{"old": true}');
      const originalStat = await stat(filePath);

      const result = await writeJsonFile(filePath, { new: true }, originalStat.mtimeMs);
      expect(result.success).toBe(true);

      const content = await readJsonFile(filePath);
      expect(content.data).toEqual({ new: true });
    });

    it("creates a new JSON file when no prior mtime exists", async () => {
      const filePath = path.join(tmpDir, "new.json");

      const result = await writeJsonFile(filePath, { created: true });
      expect(result.success).toBe(true);

      const content = await readJsonFile(filePath);
      expect(content.data).toEqual({ created: true });
    });

    it("rejects write on mtime conflict", async () => {
      const filePath = path.join(tmpDir, "conflict.json");
      await writeFile(filePath, '{"old": true}');

      const result = await writeJsonFile(filePath, { new: true }, 0);
      expect(result.success).toBe(false);
      expect(result.error).toContain("conflict");
    });
  });

  describe("readMarkdownFile", () => {
    it("reads markdown with frontmatter", async () => {
      const filePath = path.join(tmpDir, "test.md");
      await writeFile(filePath, "---\nname: test\n---\n# Hello");
      const result = await readMarkdownFile(filePath);
      expect(result.data?.frontmatter).toEqual({ name: "test" });
      expect(result.data?.content).toContain("# Hello");
    });
  });
});
