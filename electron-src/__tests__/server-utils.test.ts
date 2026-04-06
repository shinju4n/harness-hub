import { describe, it, expect } from "vitest";
import { findAvailablePort, waitForServer } from "../server-utils";
import { createServer } from "net";
import http from "http";

describe("findAvailablePort", () => {
  it("returns a port number", async () => {
    const port = await findAvailablePort(3100);
    expect(port).toBeGreaterThanOrEqual(3100);
    expect(port).toBeLessThan(3200);
  });

  it("skips occupied ports", async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(3100, "127.0.0.1", resolve));

    try {
      const port = await findAvailablePort(3100);
      expect(port).not.toBe(3100);
    } finally {
      server.close();
    }
  });
});

describe("waitForServer", () => {
  it("resolves when server is ready", async () => {
    const server = http.createServer((_, res) => {
      res.writeHead(200);
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(3199, "127.0.0.1", resolve));

    try {
      await expect(waitForServer("http://127.0.0.1:3199", 5000)).resolves.toBeUndefined();
    } finally {
      server.close();
    }
  });

  it("rejects on timeout", async () => {
    await expect(waitForServer("http://127.0.0.1:39999", 500)).rejects.toThrow("timeout");
  });
});
