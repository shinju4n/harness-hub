import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readPlans, readPlan } from "../plans-ops";
import { writeFile, mkdir, rm, utimes } from "fs/promises";
// path imported below
import path from "path";
import os from "os";

describe("plans-ops", () => {
  let tmpHome: string;
  let plansDir: string;

  beforeEach(async () => {
    tmpHome = path.join(os.tmpdir(), `harness-plans-${Date.now()}-${Math.random()}`);
    plansDir = path.join(tmpHome, "plans");
    await mkdir(plansDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpHome, { recursive: true, force: true });
  });

  describe("readPlans", () => {
    it("returns empty array when plans directory missing", async () => {
      const emptyHome = path.join(os.tmpdir(), `harness-plans-empty-${Date.now()}`);
      const plans = await readPlans(emptyHome);
      expect(plans).toEqual([]);
    });

    it("lists markdown files with frontmatter title and description", async () => {
      await writeFile(
        path.join(plansDir, "my-plan.md"),
        "---\ntitle: Refactor Auth\ndescription: Clean up\n---\n\nBody text"
      );
      const plans = await readPlans(tmpHome);
      expect(plans).toHaveLength(1);
      expect(plans[0]).toMatchObject({
        name: "my-plan",
        fileName: "my-plan.md",
        title: "Refactor Auth",
        description: "Clean up",
      });
    });

    it("ignores non-markdown files", async () => {
      await writeFile(path.join(plansDir, "note.txt"), "nope");
      await writeFile(path.join(plansDir, "a.md"), "# A");
      const plans = await readPlans(tmpHome);
      expect(plans).toHaveLength(1);
      expect(plans[0].name).toBe("a");
    });

    it("falls back to filename when frontmatter title missing", async () => {
      await writeFile(path.join(plansDir, "bare.md"), "no frontmatter");
      const plans = await readPlans(tmpHome);
      expect(plans[0].title).toBe("bare");
    });

    it("sorts by mtime descending (newest first)", async () => {
      const oldPath = path.join(plansDir, "old.md");
      const newPath = path.join(plansDir, "new.md");
      await writeFile(oldPath, "# old");
      await writeFile(newPath, "# new");
      // Force older mtime on oldPath
      const past = new Date(Date.now() - 100_000);
      await utimes(oldPath, past, past);

      const plans = await readPlans(tmpHome);
      expect(plans.map((p) => p.name)).toEqual(["new", "old"]);
    });
  });

  describe("readPlan", () => {
    it("returns raw content and parsed body for an existing plan", async () => {
      await writeFile(
        path.join(plansDir, "x.md"),
        "---\ntitle: X\n---\n\nHello body"
      );
      const result = await readPlan(tmpHome, "x");
      expect(result).not.toBeNull();
      expect(result!.content).toContain("Hello body");
      expect(result!.rawContent).toContain("title: X");
      expect(result!.frontmatter.title).toBe("X");
    });

    it("returns null for missing plan", async () => {
      const result = await readPlan(tmpHome, "missing");
      expect(result).toBeNull();
    });

    it("rejects unsafe names", async () => {
      await expect(readPlan(tmpHome, "../etc/passwd")).rejects.toThrow();
      await expect(readPlan(tmpHome, "a/b")).rejects.toThrow();
    });

    it("rejects null byte injection", async () => {
      await expect(readPlan(tmpHome, "ok\u0000.md")).rejects.toThrow();
    });

    it("rejects Windows drive-letter prefix", async () => {
      await expect(readPlan(tmpHome, "C:evil")).rejects.toThrow();
    });

    it("rejects empty name", async () => {
      await expect(readPlan(tmpHome, "")).rejects.toThrow();
    });

    it("accepts typical plan slugs with dots, dashes, underscores", async () => {
      await writeFile(path.join(plansDir, "refactor_auth-v2.md"), "# ok");
      const result = await readPlan(tmpHome, "refactor_auth-v2");
      expect(result).not.toBeNull();
    });

    it("accepts slugs with leading underscore (e.g. _draft)", async () => {
      await writeFile(path.join(plansDir, "_draft.md"), "# draft");
      const result = await readPlan(tmpHome, "_draft");
      expect(result).not.toBeNull();
    });

    it("rejects slugs with leading dot (dotfiles)", async () => {
      await expect(readPlan(tmpHome, ".hidden")).rejects.toThrow();
    });
  });
});
