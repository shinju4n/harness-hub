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
  it("resolves when server responds with expected content", async () => {
    const server = http.createServer((req, res) => {
      if (req.url === "/api/config") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ plugins: {}, skills: {} }));
      } else {
        res.writeHead(404);
        res.end();
      }
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

  it("does not resolve for non-harness server", async () => {
    const server = http.createServer((_, res) => {
      res.writeHead(200);
      res.end("some other app");
    });
    await new Promise<void>((resolve) => server.listen(3198, "127.0.0.1", resolve));

    try {
      await expect(waitForServer("http://127.0.0.1:3198", 1000)).rejects.toThrow("timeout");
    } finally {
      server.close();
    }
  });
});
