/** Events streamed from the Rust PTY reader thread (see Design-doc 5.). */
export type PtyEvent =
  | { type: "Data"; payload: string }
  | { type: "Exit" };

export type PaneId = 0 | 1 | 2 | 3;

/**
 * Pane lifecycle (Design-doc 3.4.1). "running" will be split into idle/busy
 * once shell integration (OSC 133) is wired in checkpoint 3.
 */
export type PaneStatus = "not_started" | "running" | "exited" | "error";

export interface PaneConfig {
  id: PaneId;
  title: string;
  cwd: string | null;
}
