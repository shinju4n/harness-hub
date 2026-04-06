import { app, BrowserWindow, Menu } from "electron";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { findAvailablePort, waitForServer } from "./server-utils";

let mainWindow: BrowserWindow | null = null;
let nextServer: ChildProcess | null = null;
let serverPort = 3000;

const isDev = !app.isPackaged;

function getNextBin(): string {
  if (isDev) {
    return path.join(process.cwd(), "node_modules", ".bin", "next");
  }
  return path.join(process.resourcesPath!, "app", "node_modules", ".bin", "next");
}

function getCwd(): string {
  if (isDev) {
    return process.cwd();
  }
  return path.join(process.resourcesPath!, "app");
}

async function startNextServer(): Promise<void> {
  serverPort = await findAvailablePort(3000);
  const nextBin = getNextBin();
  const cwd = getCwd();
  const command = isDev ? "dev" : "start";
  const args = [command, "--hostname", "127.0.0.1", "--port", String(serverPort)];

  if (isDev) {
    // In dev, next binary has a shebang, can run directly
    nextServer = spawn(nextBin, args, {
      cwd,
      stdio: "pipe",
      env: { ...process.env, PORT: String(serverPort) },
      shell: true,
    });
  } else {
    // In production, use Electron's bundled Node.js
    nextServer = spawn(process.execPath, [nextBin, ...args], {
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

  nextServer.stdout?.on("data", (data: Buffer) => {
    console.log(`[next] ${data.toString().trim()}`);
  });

  nextServer.stderr?.on("data", (data: Buffer) => {
    console.error(`[next] ${data.toString().trim()}`);
  });

  nextServer.on("exit", (code) => {
    console.log(`[next] process exited with code ${code}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(
        `data:text/html,<h2 style="font-family:system-ui;padding:40px;color:#666">Next.js server stopped (code ${code}). Please restart the app.</h2>`
      );
    }
  });

  await waitForServer(`http://127.0.0.1:${serverPort}`, 30000);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Harness Hub",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
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

function killNextServer(): void {
  if (nextServer && !nextServer.killed) {
    nextServer.kill("SIGTERM");
    nextServer = null;
  }
}

if (process.platform === "darwin") {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
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
    ])
  );
}

app.whenReady().then(async () => {
  try {
    await startNextServer();
    createWindow();
  } catch (err) {
    console.error("Failed to start:", err);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  killNextServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  killNextServer();
});
