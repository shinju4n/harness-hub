"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const server_utils_1 = require("./server-utils");
let mainWindow = null;
let nextServer = null;
let serverPort = 3000;
const isDev = !electron_1.app.isPackaged;
function getNextBin() {
    if (isDev) {
        return path_1.default.join(process.cwd(), "node_modules", ".bin", "next");
    }
    return path_1.default.join(process.resourcesPath, "app", "node_modules", ".bin", "next");
}
function getCwd() {
    if (isDev) {
        return process.cwd();
    }
    return path_1.default.join(process.resourcesPath, "app");
}
async function startNextServer() {
    serverPort = await (0, server_utils_1.findAvailablePort)(3000);
    const nextBin = getNextBin();
    const cwd = getCwd();
    const command = isDev ? "dev" : "start";
    const args = [command, "--hostname", "127.0.0.1", "--port", String(serverPort)];
    if (isDev) {
        // In dev, next binary has a shebang, can run directly
        nextServer = (0, child_process_1.spawn)(nextBin, args, {
            cwd,
            stdio: "pipe",
            env: { ...process.env, PORT: String(serverPort) },
            shell: true,
        });
    }
    else {
        // In production, use Electron's bundled Node.js
        nextServer = (0, child_process_1.spawn)(process.execPath, [nextBin, ...args], {
            cwd,
            stdio: "pipe",
            env: {
                ...process.env,
                PORT: String(serverPort),
                NODE_ENV: "production",
                ELECTRON_RUN_AS_NODE: "1",
            },
        });
    }
    nextServer.stdout?.on("data", (data) => {
        console.log(`[next] ${data.toString().trim()}`);
    });
    nextServer.stderr?.on("data", (data) => {
        console.error(`[next] ${data.toString().trim()}`);
    });
    nextServer.on("exit", (code) => {
        console.log(`[next] process exited with code ${code}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(`data:text/html,<h2 style="font-family:system-ui;padding:40px;color:#666">Next.js server stopped (code ${code}). Please restart the app.</h2>`);
        }
    });
    await (0, server_utils_1.waitForServer)(`http://127.0.0.1:${serverPort}`, 30000);
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: "Harness Hub",
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
    if (isDev) {
        mainWindow.webContents.openDevTools({ mode: "detach" });
    }
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
function killNextServer() {
    if (nextServer && !nextServer.killed) {
        nextServer.kill("SIGTERM");
        nextServer = null;
    }
}
if (process.platform === "darwin") {
    electron_1.Menu.setApplicationMenu(electron_1.Menu.buildFromTemplate([
        {
            label: electron_1.app.name,
            submenu: [
                { role: "about" },
                { type: "separator" },
                { role: "quit" },
            ],
        },
        {
            label: "Edit",
            submenu: [
                { role: "undo" },
                { role: "redo" },
                { type: "separator" },
                { role: "cut" },
                { role: "copy" },
                { role: "paste" },
                { role: "selectAll" },
            ],
        },
        {
            label: "View",
            submenu: [
                { role: "reload" },
                { role: "forceReload" },
                { role: "toggleDevTools" },
                { type: "separator" },
                { role: "resetZoom" },
                { role: "zoomIn" },
                { role: "zoomOut" },
            ],
        },
    ]));
}
electron_1.app.whenReady().then(async () => {
    try {
        await startNextServer();
        createWindow();
    }
    catch (err) {
        console.error("Failed to start:", err);
        electron_1.app.quit();
    }
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on("window-all-closed", () => {
    killNextServer();
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("before-quit", () => {
    killNextServer();
});
