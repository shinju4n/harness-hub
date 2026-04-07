import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  listHookFiles,
  readHookFile,
  writeHookFile,
  createHookFile,
  deleteHookFile,
} from "../hook-files-ops";
import { writeFile, mkdir, rm, readFile, symlink, utimes } from "fs/promises";
import path from "path";
import os from "os";

describe("hook-files-ops", () => {
  let tmpHome: string;
  let hooksDir: string;

  beforeEach(async () => {
    tmpHome = path.join(os.tmpdir(), `harness-hookfiles-${Date.now()}-${Math.random()}`);
    hooksDir = path.join(tmpHome, "hooks");
    await mkdir(hooksDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpHome, { recursive: true, force: true });
  });

  describe("listHookFiles", () => {
    it("returns empty when hooks dir is missing", async () => {
      const empty = path.join(os.tmpdir(), `harness-empty-${Date.now()}`);
      const files = await listHookFiles(empty);
      expect(files).toEqual([]);
    });

    it("lists supported script files with size and language", async () => {
      await writeFile(path.join(hooksDir, "pre-tool-use.mjs"), "export default 1");
      await writeFile(path.join(hooksDir, "find-node.sh"), "#!/usr/bin/env bash\n");
      const files = await listHookFiles(tmpHome);
      const names = files.map((f) => f.name).sort();
      expect(names).toEqual(["find-node.sh", "pre-tool-use.mjs"]);
      const mjs = files.find((f) => f.name === "pre-tool-use.mjs")!;
      expect(mjs.language).toBe("javascript");
      expect(mjs.size).toBeGreaterThan(0);
      const sh = files.find((f) => f.name === "find-node.sh")!;
      expect(sh.language).toBe("shell");
    });

    it("recognizes ts, py, mjs, js, cjs, sh extensions", async () => {
      const fixtures: Array<[string, string]> = [
        ["a.ts", "typescript"],
        ["b.js", "javascript"],
        ["c.mjs", "javascript"],
        ["d.cjs", "javascript"],
        ["e.py", "python"],
        ["f.sh", "shell"],
      ];
      for (const [name] of fixtures) {
        await writeFile(path.join(hooksDir, name), "x");
      }
      const files = await listHookFiles(tmpHome);
      for (const [name, lang] of fixtures) {
        expect(files.find((f) => f.name === name)?.language).toBe(lang);
      }
    });

    it("ignores unsupported extensions and dotfiles", async () => {
      await writeFile(path.join(hooksDir, "README.md"), "");
      await writeFile(path.join(hooksDir, ".DS_Store"), "");
      await writeFile(path.join(hooksDir, "ok.mjs"), "");
      const files = await listHookFiles(tmpHome);
      expect(files.map((f) => f.name)).toEqual(["ok.mjs"]);
    });

    it("sorts by name (case-insensitive)", async () => {
      await writeFile(path.join(hooksDir, "Beta.mjs"), "");
      await writeFile(path.join(hooksDir, "alpha.sh"), "");
      const files = await listHookFiles(tmpHome);
      expect(files.map((f) => f.name)).toEqual(["alpha.sh", "Beta.mjs"]);
    });
  });

  describe("readHookFile", () => {
    it("returns content + mtime for an existing file", async () => {
      const filePath = path.join(hooksDir, "x.mjs");
      await writeFile(filePath, "console.log('hi')");
      const result = await readHookFile(tmpHome, "x.mjs");
      expect(result).not.toBeNull();
      expect(result!.content).toBe("console.log('hi')");
      expect(result!.mtime).toBeGreaterThan(0);
      expect(result!.language).toBe("javascript");
    });

    it("returns null for missing file", async () => {
      const result = await readHookFile(tmpHome, "ghost.mjs");
      expect(result).toBeNull();
    });

    it("rejects path traversal", async () => {
      await expect(readHookFile(tmpHome, "../etc/passwd")).rejects.toThrow();
      await expect(readHookFile(tmpHome, "a/b.mjs")).rejects.toThrow();
    });

    it("rejects unsupported extensions", async () => {
      await expect(readHookFile(tmpHome, "evil.exe")).rejects.toThrow();
    });

    it("rejects dotfiles", async () => {
      await expect(readHookFile(tmpHome, ".secret.mjs")).rejects.toThrow();
    });
  });

  describe("writeHookFile", () => {
    it("overwrites an existing script", async () => {
      await writeFile(path.join(hooksDir, "x.mjs"), "old");
      await writeHookFile(tmpHome, "x.mjs", "new");
      const raw = await readFile(path.join(hooksDir, "x.mjs"), "utf-8");
      expect(raw).toBe("new");
    });

    it("rejects unsafe names", async () => {
      await expect(writeHookFile(tmpHome, "../etc/passwd", "x")).rejects.toThrow();
      await expect(writeHookFile(tmpHome, "evil.exe", "x")).rejects.toThrow();
    });

    it("refuses to overwrite a symlink", async () => {
      const decoy = path.join(tmpHome, "decoy.txt");
      await writeFile(decoy, "original");
      await symlink(decoy, path.join(hooksDir, "linked.mjs"));
      await expect(writeHookFile(tmpHome, "linked.mjs", "hijack")).rejects.toThrow(/symlink/i);
      const raw = await readFile(decoy, "utf-8");
      expect(raw).toBe("original");
    });
  });

  describe("createHookFile", () => {
    it("creates a new file and the hooks dir if needed", async () => {
      await rm(hooksDir, { recursive: true, force: true });
      await createHookFile(tmpHome, "fresh.mjs", "// hello");
      const raw = await readFile(path.join(hooksDir, "fresh.mjs"), "utf-8");
      expect(raw).toBe("// hello");
    });

    it("refuses to clobber an existing file", async () => {
      await writeFile(path.join(hooksDir, "x.mjs"), "original");
      await expect(createHookFile(tmpHome, "x.mjs", "new")).rejects.toThrow(/exists/i);
    });
  });

  describe("deleteHookFile", () => {
    it("removes an existing file", async () => {
      await writeFile(path.join(hooksDir, "doomed.mjs"), "bye");
      const ok = await deleteHookFile(tmpHome, "doomed.mjs");
      expect(ok).toBe(true);
    });

    it("returns false when missing", async () => {
      const ok = await deleteHookFile(tmpHome, "ghost.mjs");
      expect(ok).toBe(false);
    });

    it("refuses to delete a symlink", async () => {
      const decoy = path.join(tmpHome, "decoy.txt");
      await writeFile(decoy, "important");
      await symlink(decoy, path.join(hooksDir, "linked.sh"));
      await expect(deleteHookFile(tmpHome, "linked.sh")).rejects.toThrow(/symlink/i);
      const raw = await readFile(decoy, "utf-8");
      expect(raw).toBe("important");
    });
  });

  // Make sure the listing's mtime ordering proxy works in case we ever switch
  // to mtime-based sort in the future.
  it("populated mtime is monotonic when files are touched", async () => {
    const oldPath = path.join(hooksDir, "old.mjs");
    const newPath = path.join(hooksDir, "new.mjs");
    await writeFile(oldPath, "1");
    await writeFile(newPath, "2");
    const past = new Date(Date.now() - 100_000);
    await utimes(oldPath, past, past);
    const files = await listHookFiles(tmpHome);
    const oldFile = files.find((f) => f.name === "old.mjs")!;
    const newFile = files.find((f) => f.name === "new.mjs")!;
    expect(newFile.mtime).toBeGreaterThan(oldFile.mtime);
  });
});
