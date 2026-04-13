import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readAgentDefinitions } from "../agent-ops";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import os from "os";

describe("agent-ops", () => {
  let tmpHome: string;
  let agentsDir: string;

  beforeEach(async () => {
    tmpHome = path.join(os.tmpdir(), `harness-agents-${Date.now()}-${Math.random()}`);
    agentsDir = path.join(tmpHome, "agents");
    await mkdir(agentsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpHome, { recursive: true, force: true });
  });

  describe("readAgentDefinitions", () => {
    it("returns empty array when agents directory is missing", async () => {
      const empty = path.join(os.tmpdir(), `harness-agents-empty-${Date.now()}`);
      const agents = await readAgentDefinitions(empty);
      expect(agents).toEqual([]);
    });

    it("parses basic frontmatter fields", async () => {
      await writeFile(
        path.join(agentsDir, "reviewer.md"),
        "---\nname: reviewer\ndescription: Reviews PRs\nmodel: sonnet\n---\n\nReview prompt body"
      );
      const agents = await readAgentDefinitions(tmpHome);
      expect(agents).toHaveLength(1);
      expect(agents[0]).toMatchObject({
        name: "reviewer",
        description: "Reviews PRs",
        model: "sonnet",
      });
      expect(agents[0].body).toContain("Review prompt body");
    });

    it("parses skills frontmatter as a string array", async () => {
      await writeFile(
        path.join(agentsDir, "api-dev.md"),
        "---\nname: api-dev\ndescription: API developer\nskills:\n  - api-conventions\n  - error-handling-patterns\n---\n\nbody"
      );
      const agents = await readAgentDefinitions(tmpHome);
      expect(agents).toHaveLength(1);
      expect(agents[0].skills).toEqual(["api-conventions", "error-handling-patterns"]);
    });

    it("leaves skills undefined when not present in frontmatter", async () => {
      await writeFile(
        path.join(agentsDir, "plain.md"),
        "---\nname: plain\ndescription: nothing special\n---\n\nbody"
      );
      const agents = await readAgentDefinitions(tmpHome);
      expect(agents[0].skills).toBeUndefined();
    });

    it("drops non-string entries from the skills array", async () => {
      await writeFile(
        path.join(agentsDir, "dirty.md"),
        "---\nname: dirty\ndescription: x\nskills:\n  - good\n  - null\n  - 42\n  - \n---\n"
      );
      const agents = await readAgentDefinitions(tmpHome);
      expect(agents[0].skills).toEqual(["good"]);
    });

    it("treats non-array skills as undefined", async () => {
      await writeFile(
        path.join(agentsDir, "bad.md"),
        "---\nname: bad\ndescription: x\nskills: just-one\n---\n"
      );
      const agents = await readAgentDefinitions(tmpHome);
      expect(agents[0].skills).toBeUndefined();
    });

    it("rethrows non-ENOENT errors reading agents directory", async () => {
      const filePath = path.join(tmpHome, "not-a-dir");
      await writeFile(filePath, "x");
      await expect(readAgentDefinitions(filePath)).rejects.toThrow();
    });

    it("ignores non-markdown files", async () => {
      await writeFile(path.join(agentsDir, "note.txt"), "nope");
      await writeFile(path.join(agentsDir, "a.md"), "---\nname: a\ndescription: x\n---\n");
      const agents = await readAgentDefinitions(tmpHome);
      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe("a");
    });
  });
});
