import type { PtyEvent } from "../types";

/**
 * Abstraction over the four PTY IPC commands so the UI can be driven by
 * the Tauri backend or by a mock in tests.
 */
export interface PtyClient {
  spawn(
    paneId: number,
    rows: number,
    cols: number,
    cwd: string | null,
    onEvent: (event: PtyEvent) => void,
  ): Promise<void>;
  write(paneId: number, data: string): Promise<void>;
  resize(paneId: number, rows: number, cols: number): Promise<void>;
  kill(paneId: number): Promise<void>;
}
