import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronTerminal", {
  create: (options: {
    pathname: string;
    claudeHome: string | null;
    cols: number;
    rows: number;
  }): Promise<{ id: string; cwd: string }> =>
    ipcRenderer.invoke("terminal:create", options),

  write: (id: string, data: string): void => {
    ipcRenderer.send("terminal:write", { id, data });
  },

  resize: (id: string, cols: number, rows: number): void => {
    ipcRenderer.send("terminal:resize", { id, cols, rows });
  },

  kill: (id: string): void => {
    ipcRenderer.send("terminal:kill", { id });
  },

  onData: (cb: (id: string, data: string) => void): (() => void) => {
    const handler = (_e: unknown, payload: { id: string; data: string }) =>
      cb(payload.id, payload.data);
    ipcRenderer.on("terminal:data", handler);
    return () => ipcRenderer.removeListener("terminal:data", handler);
  },

  onExit: (cb: (id: string, code: number) => void): (() => void) => {
    const handler = (_e: unknown, payload: { id: string; code: number }) =>
      cb(payload.id, payload.code);
    ipcRenderer.on("terminal:exit", handler);
    return () => ipcRenderer.removeListener("terminal:exit", handler);
  },
});

contextBridge.exposeInMainWorld("electronVersionStore", {
  getBasePath: (): Promise<string> =>
    ipcRenderer.invoke("version-store:base-path"),

  onWindowRegainFocus: (cb: () => void): (() => void) => {
    const handler = () => cb();
    ipcRenderer.on("window:regain-focus", handler);
    return () => ipcRenderer.removeListener("window:regain-focus", handler);
  },
});
