import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { putObject, getObject, hasObject, hashContent } from "../version-store";
import { mkdir, rm } from "fs/promises";
import path from "path";
import os from "os";

describe("object store", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = path.join(os.tmpdir(), `vs-test-${Date.now()}`);
    await mkdir(baseDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it("hashContent returns sha256 prefixed hex", () => {
    const hash = hashContent("hello");
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("stores and retrieves content by hash", async () => {
    const content = "hello world";
    const hash = await putObject(baseDir, content);
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    const retrieved = await getObject(baseDir, hash);
    expect(retrieved).toBe(content);
  });

  it("deduplicates identical content", async () => {
    const h1 = await putObject(baseDir, "same");
    const h2 = await putObject(baseDir, "same");
    expect(h1).toBe(h2);
  });

  it("hasObject returns true for existing, false for missing", async () => {
    const hash = await putObject(baseDir, "exists");
    expect(await hasObject(baseDir, hash)).toBe(true);
    expect(await hasObject(baseDir, "sha256:0000000000000000000000000000000000000000000000000000000000000000")).toBe(false);
  });

  it("handles different content with different hashes", async () => {
    const h1 = await putObject(baseDir, "content A");
    const h2 = await putObject(baseDir, "content B");
    expect(h1).not.toBe(h2);
    expect(await getObject(baseDir, h1)).toBe("content A");
    expect(await getObject(baseDir, h2)).toBe("content B");
  });
});
