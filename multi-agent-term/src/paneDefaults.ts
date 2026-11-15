import type { PaneConfig } from "./types";

/** Static pane definitions until config.json loading lands in checkpoint 4. */
export const DEFAULT_PANES: readonly PaneConfig[] = [
  { id: 0, title: "Agent 1 (Main)", cwd: null },
  { id: 1, title: "Agent 2 (Sub)", cwd: null },
  { id: 2, title: "Agent 3 (Review)", cwd: null },
  { id: 3, title: "Manual PowerShell", cwd: null },
];
