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

declare global {
  interface Window {
    electronTerminal?: ElectronTerminalAPI;
  }
}

export {};
