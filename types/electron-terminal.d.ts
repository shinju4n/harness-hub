export interface ElectronTerminalAPI {
  create(options: {
    pathname: string;
    claudeHome: string | null;
    cols: number;
    rows: number;
  }): Promise<{ id: string; cwd: string }>;
  write(id: string, data: string): void;
  resize(id: string, cols: number, rows: number): void;
  kill(id: string): void;
  onData(cb: (id: string, data: string) => void): () => void;
  onExit(cb: (id: string, code: number) => void): () => void;
}

export interface ElectronUpdaterEvent {
  type: "checking" | "available" | "not-available" | "progress" | "downloaded" | "error";
  version?: string;
  percent?: number;
  message?: string;
}

export interface ElectronUpdaterState {
  status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";
  version?: string;
  percent?: number;
  message?: string;
}

export interface ElectronUpdaterAPI {
  checkForUpdates(): void;
  quitAndInstall(): void;
  getState(): Promise<ElectronUpdaterState>;
  onEvent(cb: (event: ElectronUpdaterEvent) => void): () => void;
}

declare global {
  interface Window {
    electronTerminal?: ElectronTerminalAPI;
    electronUpdater?: ElectronUpdaterAPI;
  }
}

export {};
