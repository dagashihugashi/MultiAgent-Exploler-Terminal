/** Events streamed from the Rust PTY reader thread (see Design-doc 5.). */
export type PtyEvent =
  | { type: "Data"; payload: string }
  | { type: "Exit" };

export type PaneId = 0 | 1 | 2 | 3;
