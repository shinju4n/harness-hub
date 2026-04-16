import { createServer } from "net";
import http from "http";

export function findAvailablePort(startPort: number): Promise<number> {
  const maxPort = Math.min(65535, startPort + 99);

  const tryPort = (port: number): Promise<number> =>
    new Promise((resolve, reject) => {
      const server = createServer();
      server.once("error", (err) => {
        server.close();
        if (port < maxPort) {
          resolve(tryPort(port + 1));
          return;
        }
        reject(err);
      });
      server.listen(port, "127.0.0.1", () => {
        server.close((closeErr) => {
          if (closeErr) {
            reject(closeErr);
            return;
          }
          resolve(port);
        });
      });
    });

  return tryPort(startPort);
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
        .get(url, (res) => {
          // Any response means the server is up
          // Consume the response body to free resources
          res.resume();
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            setTimeout(check, 300);
          }
        })
        .on("error", () => {
          setTimeout(check, 300);
        });
    };
    check();
  });
}
