import { createServer } from "net";
import http from "http";

export function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(startPort, "127.0.0.1", () => {
      server.close(() => resolve(startPort));
    });
    server.on("error", () => {
      if (startPort < startPort + 100) {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(new Error("No available port found"));
      }
    });
  });
}

export function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server startup timeout after ${timeoutMs}ms`));
        return;
      }
      http
        .get(url + "/api/config", (res) => {
          let body = "";
          res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
          res.on("end", () => {
            // Verify this is actually our Harness Hub server
            if (res.statusCode && res.statusCode < 500 && body.includes("plugins")) {
              resolve();
            } else {
              setTimeout(check, 300);
            }
          });
        })
        .on("error", () => {
          setTimeout(check, 300);
        });
    };
    check();
  });
}
