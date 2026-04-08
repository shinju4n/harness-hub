import { describe, it, expect, vi, beforeEach } from "vitest";
import { TerminalManager, type PtyLike, type PtyFactory } from "../terminal-manager";

function makeMockPty(): PtyLike & {
  _emit: (event: "data" | "exit", payload: unknown) => void;
} {
  const handlers: Record<string, ((p: unknown) => void)[]> = {};
  return {
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: (cb) => {
      (handlers["data"] ||= []).push(cb as (p: unknown) => void);
      return { dispose: () => {} };
    },
    onExit: (cb) => {
      (handlers["exit"] ||= []).push(cb as (p: unknown) => void);
      return { dispose: () => {} };
    },
    _emit: (event, payload) => {
      (handlers[event] || []).forEach((h) => h(payload));
    },
  };
}

describe("TerminalManager", () => {
  let mockPty: ReturnType<typeof makeMockPty>;
  let factory: PtyFactory;
  let manager: TerminalManager;
  let dataEvents: { id: string; data: string }[];
  let exitEvents: { id: string; code: number }[];

  beforeEach(() => {
    mockPty = makeMockPty();
    factory = vi.fn(() => mockPty);
    dataEvents = [];
    exitEvents = [];
    manager = new TerminalManager({
      ptyFactory: factory,
      onData: (id, data) => dataEvents.push({ id, data }),
      onExit: (id, code) => exitEvents.push({ id, code }),
    });
  });

  it("creates a pty session and returns its id", () => {
    const id = manager.create({ cwd: "/tmp", cols: 80, rows: 24 });
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: "/tmp", cols: 80, rows: 24 }),
    );
  });

  it("returns distinct ids for each session", () => {
    const id1 = manager.create({ cwd: "/a", cols: 80, rows: 24 });
    (factory as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeMockPty());
    const id2 = manager.create({ cwd: "/b", cols: 80, rows: 24 });
    expect(id1).not.toBe(id2);
  });

  it("forwards data events to the onData callback", () => {
    const id = manager.create({ cwd: "/tmp", cols: 80, rows: 24 });
    mockPty._emit("data", "hello");
    expect(dataEvents).toEqual([{ id, data: "hello" }]);
  });

  it("forwards exit events to the onExit callback", () => {
    const id = manager.create({ cwd: "/tmp", cols: 80, rows: 24 });
    mockPty._emit("exit", { exitCode: 0 });
    expect(exitEvents).toEqual([{ id, code: 0 }]);
  });

  it("auto-cleans session on exit (subsequent write is no-op)", () => {
    const id = manager.create({ cwd: "/tmp", cols: 80, rows: 24 });
    mockPty._emit("exit", { exitCode: 0 });
    manager.write(id, "ls\n");
    expect(mockPty.write).not.toHaveBeenCalled();
  });

  it("write() forwards to the underlying pty", () => {
    const id = manager.create({ cwd: "/tmp", cols: 80, rows: 24 });
    manager.write(id, "ls\n");
    expect(mockPty.write).toHaveBeenCalledWith("ls\n");
  });

  it("resize() forwards cols/rows to the underlying pty", () => {
    const id = manager.create({ cwd: "/tmp", cols: 80, rows: 24 });
    manager.resize(id, 100, 30);
    expect(mockPty.resize).toHaveBeenCalledWith(100, 30);
  });

  it("kill() removes the session and calls pty.kill", () => {
    const id = manager.create({ cwd: "/tmp", cols: 80, rows: 24 });
    manager.kill(id);
    expect(mockPty.kill).toHaveBeenCalled();
    expect(() => manager.write(id, "x")).not.toThrow();
  });

  it("write/resize/kill on unknown id are no-ops", () => {
    expect(() => manager.write("ghost", "x")).not.toThrow();
    expect(() => manager.resize("ghost", 80, 24)).not.toThrow();
    expect(() => manager.kill("ghost")).not.toThrow();
  });

  it("killAll closes every session", () => {
    manager.create({ cwd: "/a", cols: 80, rows: 24 });
    const mockPty2 = makeMockPty();
    (factory as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockPty2);
    manager.create({ cwd: "/b", cols: 80, rows: 24 });
    manager.killAll();
    expect(mockPty.kill).toHaveBeenCalled();
    expect(mockPty2.kill).toHaveBeenCalled();
  });
});
