/** Events streamed from the Rust PTY reader thread (see Design-doc 5.). */
export type PtyEvent =
  | { type: "Data"; payload: string }
  | { type: "Exit" };

export type PaneId = 0 | 1 | 2 | 3;

/** Pane lifecycle (Design-doc 3.4.1). */
export type PaneStatus =
  | "not_started" // never spawned (lazy spawn)
  | "busy" // command running: after Enter, until the next OSC 133;A
  | "idle" // prompt shown (OSC 133;A received)
  | "exited" // process ended or was killed
  | "error"; // spawn/write failed

export interface PaneRuntime {
  status: PaneStatus;
  /** Actual $pwd reported through OSC 9;9, null until the first prompt. */
  cwd: string | null;
  /** Epoch ms of the last transition into busy, for duration display. */
  busySince: number | null;
  /** Last non-empty line of the parsed xterm buffer. */
  lastOutputLine: string;
}

export const INITIAL_RUNTIME: PaneRuntime = {
  status: "not_started",
  cwd: null,
  busySince: null,
  lastOutputLine: "",
};

export interface PaneConfig {
  id: PaneId;
  title: string;
  cwd: string | null;
}
