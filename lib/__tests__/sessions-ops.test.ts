import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readSessions } from "../sessions-ops";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import os from "os";

describe("sessions-ops", () => {
  let tmpHome: string;
  let sessionsDir: string;

  beforeEach(async () => {
    tmpHome = path.join(os.tmpdir(), `harness-sessions-${Date.now()}-${Math.random()}`);
    sessionsDir = path.join(tmpHome, "sessions");
    await mkdir(sessionsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpHome, { recursive: true, force: true });
  });

  it("returns empty array when sessions directory does not exist", async () => {
    const emptyHome = path.join(os.tmpdir(), `harness-empty-${Date.now()}`);
    const sessions = await readSessions(emptyHome);
    expect(sessions).toEqual([]);
  });

  it("reads valid session JSON files", async () => {
    const data = {
      pid: 12345,
      sessionId: "abc-123",
      cwd: "/some/path",
      startedAt: 1700000000000,
      kind: "interactive",
      entrypoint: "cli",
    };
    await writeFile(path.join(sessionsDir, "12345.json"), JSON.stringify(data));

    const sessions = await readSessions(tmpHome);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      pid: 12345,
      sessionId: "abc-123",
      cwd: "/some/path",
      kind: "interactive",
      entrypoint: "cli",
    });
    expect(sessions[0].startedAt).toBe(1700000000000);
    expect(sessions[0].fileName).toBe("12345.json");
  });

  it("ignores non-JSON files", async () => {
    await writeFile(path.join(sessionsDir, "README.txt"), "nope");
    await writeFile(
      path.join(sessionsDir, "ok.json"),
      JSON.stringify({ pid: 1, sessionId: "s", cwd: "/", startedAt: 1, kind: "interactive", entrypoint: "cli" })
    );

    const sessions = await readSessions(tmpHome);
    expect(sessions).toHaveLength(1);
  });

  it("ignores hidden (dotfile) JSON files", async () => {
    await writeFile(
      path.join(sessionsDir, ".tmp.json"),
      JSON.stringify({ pid: 1, sessionId: "hidden", cwd: "/", startedAt: 1, kind: "interactive", entrypoint: "cli" })
    );
    await writeFile(
      path.join(sessionsDir, "ok.json"),
      JSON.stringify({ pid: 2, sessionId: "real", cwd: "/", startedAt: 2, kind: "interactive", entrypoint: "cli" })
    );

    const sessions = await readSessions(tmpHome);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe("real");
  });

  it("skips malformed JSON instead of throwing", async () => {
    await writeFile(path.join(sessionsDir, "bad.json"), "{not valid json");
    await writeFile(
      path.join(sessionsDir, "good.json"),
      JSON.stringify({ pid: 2, sessionId: "s2", cwd: "/", startedAt: 2, kind: "interactive", entrypoint: "cli" })
    );

    const sessions = await readSessions(tmpHome);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe("s2");
  });

  it("sorts sessions by startedAt descending (newest first)", async () => {
    await writeFile(
      path.join(sessionsDir, "a.json"),
      JSON.stringify({ pid: 1, sessionId: "old", cwd: "/", startedAt: 1000, kind: "interactive", entrypoint: "cli" })
    );
    await writeFile(
      path.join(sessionsDir, "b.json"),
      JSON.stringify({ pid: 2, sessionId: "new", cwd: "/", startedAt: 9000, kind: "interactive", entrypoint: "cli" })
    );

    const sessions = await readSessions(tmpHome);
    expect(sessions.map((s) => s.sessionId)).toEqual(["new", "old"]);
  });
});
