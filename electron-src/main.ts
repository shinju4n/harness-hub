import { app, BrowserWindow, Menu, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import { spawn, fork, ChildProcess } from "child_process";
import path from "path";
import { findAvailablePort, waitForServer } from "./server-utils";
import { createUpdaterController, type UpdaterController, type UpdaterEvent } from "./updater";

let mainWindow: BrowserWindow | null = null;
let nextServer: ChildProcess | null = null;
let serverPort = 13100;
let updaterController: UpdaterController | null = null;

const isDev = !app.isPackaged;

function getAppPath(): string {
  if (isDev) {
    return process.cwd();
  }
  // In packaged app with asarUnpack, standalone lives outside asar
  return path.join(process.resourcesPath!, "app.asar.unpacked");
}

async function startNextServer(): Promise<void> {
  serverPort = await findAvailablePort(13100);
  const appPath = getAppPath();

  if (isDev) {
    const nextBin = path.join(appPath, "node_modules", ".bin", "next");
    nextServer = spawn(nextBin, ["dev", "--hostname", "127.0.0.1", "--port", String(serverPort)], {
      cwd: appPath,
      stdio: "pipe",
      env: { ...process.env, PORT: String(serverPort) },
      shell: true,
    });
  } else {
    // In production: use standalone server.js
    const serverJs = path.join(appPath, "server.js");
    nextServer = fork(serverJs, [], {
      cwd: appPath,
      stdio: "pipe",
      env: {
        ...process.env,
        PORT: String(serverPort),
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
      },
    });
  }

  nextServer.stdout?.on("data", (data: Buffer) => {
    console.log(`[next] ${data.toString().trim()}`);
  });

  nextServer.stderr?.on("data", (data: Buffer) => {
    console.error(`[next] ${data.toString().trim()}`);
  });

  nextServer.on("error", (err) => {
    console.error("[next] spawn error:", err);
    dialog.showErrorBox(
      "Harness Hub",
      `Failed to start the server:\n${err.message}`
    );
  });

  nextServer.on("exit", (code) => {
    console.log(`[next] process exited with code ${code}`);
    if (code !== 0 && code !== null && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(
        `data:text/html,<div style="font-family:system-ui;padding:40px;text-align:center"><h2 style="color:#333">Server stopped</h2><p style="color:#666">Exit code: ${code}. Please restart the app.</p></div>`
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

function handleUpdaterEvent(event: UpdaterEvent): void {
  switch (event.type) {
    case "checking":
      console.log("[updater] checking for updates");
      break;
    case "available":
      console.log(`[updater] update available: v${event.version}`);
      break;
    case "not-available":
      console.log("[updater] already up to date");
      break;
    case "progress":
      console.log(`[updater] downloading ${event.percent}%`);
      break;
    case "downloaded":
      console.log(`[updater] v${event.version} downloaded — will install on quit`);
      break;
    case "error":
      console.error(`[updater] error: ${event.message}`);
      break;
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

    // Only check for updates in packaged builds; dev mode has no stable version.
    updaterController = createUpdaterController({
      updater: autoUpdater,
      enabled: app.isPackaged,
      onEvent: handleUpdaterEvent,
    });
    updaterController.start();
  } catch (err) {
    console.error("Failed to start:", err);
    dialog.showErrorBox(
      "Harness Hub",
      `Failed to start:\n${(err as Error).message}\n\nThe app will now close.`
    );
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    killNextServer();
    app.quit();
  }
  // macOS: keep server running, window will reopen on activate
});

app.on("before-quit", () => {
  updaterController?.stop();
  killNextServer();
});
