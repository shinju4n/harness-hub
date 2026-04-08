import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readImages, listImageProjects, loadImageBytes } from "../images-ops";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import os from "os";

// 1×1 transparent PNG
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=";

function imageBlock(media = "image/png", data = PNG_B64) {
  return { type: "image", source: { type: "base64", media_type: media, data } };
}

function userRecord(opts: {
  uuid: string;
  ts: string;
  cwd?: string;
  sessionId: string;
  content: unknown[];
}) {
  return JSON.stringify({
    type: "user",
    uuid: opts.uuid,
    timestamp: opts.ts,
    cwd: opts.cwd,
    sessionId: opts.sessionId,
    message: { role: "user", content: opts.content },
  });
}

describe("images-ops", () => {
  let tmpHome: string;
  let projectsRoot: string;

  beforeEach(async () => {
    tmpHome = path.join(os.tmpdir(), `harness-images-${Date.now()}-${Math.random()}`);
    projectsRoot = path.join(tmpHome, "projects");
    await mkdir(projectsRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpHome, { recursive: true, force: true });
  });

  it("returns empty page when projects directory does not exist", async () => {
    const empty = path.join(os.tmpdir(), `harness-images-empty-${Date.now()}`);
    const page = await readImages(empty, { limit: 10 });
    expect(page.entries).toEqual([]);
    expect(page.total).toBe(0);
  });

  it("extracts image blocks from a session jsonl", async () => {
    const projectDir = path.join(projectsRoot, "-Users-me-Documents-foo");
    await mkdir(projectDir, { recursive: true });
    const lines = [
      userRecord({
        uuid: "msg-1",
        ts: "2026-04-01T10:00:00.000Z",
        cwd: "/Users/me/Documents/foo",
        sessionId: "sess-1",
        content: [
          { type: "text", text: "look" },
          imageBlock("image/png"),
        ],
      }),
      userRecord({
        uuid: "msg-2",
        ts: "2026-04-02T10:00:00.000Z",
        cwd: "/Users/me/Documents/foo",
        sessionId: "sess-1",
        content: [imageBlock("image/jpeg"), imageBlock("image/png")],
      }),
      // A line that mentions "image" but is not an image block — must not throw.
      JSON.stringify({ type: "system", text: 'the word "type":"image" appears here too' }),
    ];
    await writeFile(path.join(projectDir, "sess-1.jsonl"), lines.join("\n"));

    const page = await readImages(tmpHome, { limit: 10 });
    expect(page.total).toBe(3);
    // Sorted newest-first.
    expect(page.entries[0].messageUuid).toBe("msg-2");
    expect(page.entries[0].blockIndex).toBe(0);
    expect(page.entries[0].mediaType).toBe("image/jpeg");
    expect(page.entries[2].messageUuid).toBe("msg-1");
    expect(page.entries[0].projectLabel).toBe("/Users/me/Documents/foo");
    expect(page.entries[0].sessionId).toBe("sess-1");
  });

  it("paginates with limit/offset and filters by project", async () => {
    const dirA = path.join(projectsRoot, "-projA");
    const dirB = path.join(projectsRoot, "-projB");
    await mkdir(dirA, { recursive: true });
    await mkdir(dirB, { recursive: true });
    await writeFile(
      path.join(dirA, "a.jsonl"),
      userRecord({ uuid: "a1", ts: "2026-04-01T00:00:00Z", sessionId: "a", content: [imageBlock()] })
    );
    await writeFile(
      path.join(dirB, "b.jsonl"),
      userRecord({ uuid: "b1", ts: "2026-04-02T00:00:00Z", sessionId: "b", content: [imageBlock(), imageBlock()] })
    );

    const all = await readImages(tmpHome, { limit: 10 });
    expect(all.total).toBe(3);

    const filtered = await readImages(tmpHome, { limit: 10, project: "-projB" });
    expect(filtered.total).toBe(2);
    expect(filtered.entries.every((e) => e.projectDir === "-projB")).toBe(true);

    const paged = await readImages(tmpHome, { limit: 1, offset: 1 });
    expect(paged.entries).toHaveLength(1);
  });

  it("listImageProjects counts images per project", async () => {
    const dirA = path.join(projectsRoot, "-a");
    const dirB = path.join(projectsRoot, "-b");
    await mkdir(dirA, { recursive: true });
    await mkdir(dirB, { recursive: true });
    await writeFile(
      path.join(dirA, "x.jsonl"),
      userRecord({ uuid: "u", ts: "2026-04-01T00:00:00Z", sessionId: "x", content: [imageBlock(), imageBlock()] })
    );
    await writeFile(
      path.join(dirB, "y.jsonl"),
      userRecord({ uuid: "v", ts: "2026-04-01T00:00:00Z", sessionId: "y", content: [imageBlock()] })
    );

    const projects = await listImageProjects(tmpHome);
    expect(projects).toHaveLength(2);
    // Sorted by count desc.
    expect(projects[0].dir).toBe("-a");
    expect(projects[0].count).toBe(2);
    expect(projects[1].count).toBe(1);
  });

  it("loadImageBytes round-trips the base64 payload", async () => {
    const projectDir = path.join(projectsRoot, "-roundtrip");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      path.join(projectDir, "rt.jsonl"),
      userRecord({
        uuid: "msg",
        ts: "2026-04-01T00:00:00Z",
        sessionId: "rt",
        content: [{ type: "text", text: "x" }, imageBlock("image/png")],
      })
    );

    const page = await readImages(tmpHome, { limit: 1 });
    expect(page.entries).toHaveLength(1);
    const id = page.entries[0].id;
    const result = await loadImageBytes(tmpHome, id);
    expect(result).not.toBeNull();
    expect(result!.mediaType).toBe("image/png");
    expect(result!.bytes.toString("base64")).toBe(PNG_B64);
  });

  it("loadImageBytes refuses path-traversal ids", async () => {
    // Manually craft a malicious id by base64-encoding a path-component.
    const malicious = Buffer.from(
      ["../etc", "passwd.jsonl", "uuid", "0"].join("\u001f"),
      "utf-8"
    ).toString("base64url");
    const result = await loadImageBytes(tmpHome, malicious);
    expect(result).toBeNull();
  });

  it("loadImageBytes returns null for unknown ids", async () => {
    const unknown = Buffer.from(["-x", "y.jsonl", "u", "0"].join("\u001f"), "utf-8").toString("base64url");
    const result = await loadImageBytes(tmpHome, unknown);
    expect(result).toBeNull();
  });

  it("ignores uuid-less records — they cannot be re-located on click", async () => {
    const projectDir = path.join(projectsRoot, "-no-uuid");
    await mkdir(projectDir, { recursive: true });
    // First record has no `uuid` field — must be skipped.
    const noUuid = JSON.stringify({
      type: "user",
      timestamp: "2026-04-01T00:00:00Z",
      sessionId: "x",
      message: { content: [imageBlock()] },
    });
    // Second record has a uuid — must be picked up.
    const withUuid = userRecord({
      uuid: "ok",
      ts: "2026-04-02T00:00:00Z",
      sessionId: "x",
      content: [imageBlock()],
    });
    await writeFile(path.join(projectDir, "x.jsonl"), [noUuid, withUuid].join("\n"));

    const page = await readImages(tmpHome, { limit: 10 });
    expect(page.total).toBe(1);
    expect(page.entries[0].messageUuid).toBe("ok");
  });

  it("ignores text content that contains the literal substring 'type:image'", async () => {
    // A user message whose text body literally types out the image-block
    // shape — common when discussing the API. Must NOT be extracted.
    const projectDir = path.join(projectsRoot, "-textmention");
    await mkdir(projectDir, { recursive: true });
    const trickyText = userRecord({
      uuid: "trick",
      ts: "2026-04-01T00:00:00Z",
      sessionId: "x",
      content: [
        { type: "text", text: 'the API uses {"type":"image","source":{"type":"base64",...}}' },
      ],
    });
    await writeFile(path.join(projectDir, "x.jsonl"), trickyText);

    const page = await readImages(tmpHome, { limit: 10 });
    expect(page.total).toBe(0);
  });

  it("ignores message.content shaped as a plain string", async () => {
    const projectDir = path.join(projectsRoot, "-stringcontent");
    await mkdir(projectDir, { recursive: true });
    // Pre-filter substring matches but content is a string, so the inner
    // `Array.isArray` check kicks in and we skip without throwing.
    const stringContent = JSON.stringify({
      type: "user",
      uuid: "u",
      timestamp: "2026-04-01T00:00:00Z",
      sessionId: "x",
      message: { role: "user", content: 'this string mentions "type":"image" verbatim' },
    });
    await writeFile(path.join(projectDir, "x.jsonl"), stringContent);

    const page = await readImages(tmpHome, { limit: 10 });
    expect(page.total).toBe(0);
  });

  it("listImageProjects returns counts without materializing entries", async () => {
    // listImageProjects delegates to readImages({ limit: 0, withFacets: true })
    // which must NOT push entries into memory. We can't introspect memory
    // directly, but we can at least confirm the public surface returns
    // counts and an empty entries[] when fetched explicitly.
    const projectDir = path.join(projectsRoot, "-cheap-facets");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      path.join(projectDir, "x.jsonl"),
      userRecord({ uuid: "u", ts: "2026-04-01T00:00:00Z", sessionId: "x", content: [imageBlock(), imageBlock(), imageBlock()] })
    );
    const projects = await listImageProjects(tmpHome);
    expect(projects).toHaveLength(1);
    expect(projects[0].count).toBe(3);

    // And via readImages directly with limit:0:
    const facetsOnly = await readImages(tmpHome, { limit: 0 }, { withFacets: true });
    expect(facetsOnly.entries).toEqual([]);
    expect(facetsOnly.total).toBe(3);
    expect(facetsOnly.projects?.[0].count).toBe(3);
  });

  it("withFacets returns entries and projects in a single scan", async () => {
    const dirA = path.join(projectsRoot, "-projA");
    const dirB = path.join(projectsRoot, "-projB");
    await mkdir(dirA, { recursive: true });
    await mkdir(dirB, { recursive: true });
    await writeFile(
      path.join(dirA, "a.jsonl"),
      userRecord({ uuid: "a", ts: "2026-04-01T00:00:00Z", sessionId: "a", content: [imageBlock(), imageBlock()] })
    );
    await writeFile(
      path.join(dirB, "b.jsonl"),
      userRecord({ uuid: "b", ts: "2026-04-02T00:00:00Z", sessionId: "b", content: [imageBlock()] })
    );

    const page = await readImages(tmpHome, { limit: 10 }, { withFacets: true });
    expect(page.total).toBe(3);
    expect(page.projects).toBeDefined();
    expect(page.projects).toHaveLength(2);
    // Sorted by count desc.
    expect(page.projects![0].count).toBe(2);
  });

  it("loadImageBytes refuses an id whose decoded path escapes the projects root", async () => {
    // The id's projectDir is well-formed (no `..`, no slashes) but is the
    // empty-looking value `.` — `path.resolve(projectsRoot, ".", "x.jsonl")`
    // resolves to `<projectsRoot>/x.jsonl`, which is *inside* the boundary.
    // That's not an escape, so this case should still attempt to read.
    // Use a more devious case: we craft a malicious decoded form by
    // bypassing decodeImageId via direct base64 — but the decoder rejects
    // anything with `/`, so we can only test the "stays inside" branch.
    // Sanity-check the boundary check by passing a legit id and confirming
    // it round-trips (the existing round-trip test already covers this).
    const malicious = Buffer.from(
      ["..", "passwd.jsonl", "u", "0"].join("\u001f"),
      "utf-8"
    ).toString("base64url");
    // decodeImageId rejects `..` substring → returns null → loadImageBytes null.
    expect(await loadImageBytes(tmpHome, malicious)).toBeNull();
  });
});
