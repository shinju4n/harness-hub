export interface ElectronTerminalAPI {
  create(options: { cwd: string; cols: number; rows: number }): Promise<string>;
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
