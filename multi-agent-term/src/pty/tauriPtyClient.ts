import { Channel, invoke } from "@tauri-apps/api/core";
import type { PtyEvent } from "../types";
import type { PtyClient } from "./PtyClient";

export const tauriPtyClient: PtyClient = {
  async spawn(paneId, rows, cols, cwd, onEvent) {
    const onData = new Channel<PtyEvent>();
    onData.onmessage = onEvent;
    await invoke("spawn_pty", { paneId, rows, cols, cwd, onData });
  },
  write(paneId, data) {
    return invoke("write_pty", { paneId, data });
  },
  resize(paneId, rows, cols) {
    return invoke("resize_pty", { paneId, rows, cols });
  },
  kill(paneId) {
    return invoke("kill_pty", { paneId });
  },
};
