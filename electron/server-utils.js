"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAvailablePort = findAvailablePort;
exports.waitForServer = waitForServer;
const net_1 = require("net");
const http_1 = __importDefault(require("http"));
function findAvailablePort(startPort) {
    return new Promise((resolve, reject) => {
        const server = (0, net_1.createServer)();
        server.listen(startPort, "127.0.0.1", () => {
            server.close(() => resolve(startPort));
        });
        server.on("error", () => {
            if (startPort < startPort + 100) {
                resolve(findAvailablePort(startPort + 1));
            }
            else {
                reject(new Error("No available port found"));
            }
        });
    });
}
function waitForServer(url, timeoutMs) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const check = () => {
            if (Date.now() - start > timeoutMs) {
                reject(new Error(`Server startup timeout after ${timeoutMs}ms`));
                return;
            }
            http_1.default
                .get(url, (res) => {
                if (res.statusCode && res.statusCode < 500) {
                    resolve();
                }
                else {
                    setTimeout(check, 200);
                }
            })
                .on("error", () => {
                setTimeout(check, 200);
            });
        };
        check();
    });
}
