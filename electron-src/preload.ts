import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronTerminal", {
  create: (options: { cwd: string; cols: number; rows: number }): Promise<string> =>
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
