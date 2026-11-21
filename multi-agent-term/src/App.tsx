import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AgentBoardPanel } from "./components/AgentBoardPanel";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { GlobalToolbar } from "./components/GlobalToolbar";
import { HiddenPanesIndicator, type HiddenPaneEntry } from "./components/HiddenPanesIndicator";
import { PaneGrid } from "./components/PaneGrid";
import { TerminalPane, type PaneHandle } from "./components/TerminalPane";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { hiddenPanes, visiblePanes } from "./layout";
import { DEFAULT_PANES } from "./paneDefaults";
import { tauriPtyClient } from "./pty/tauriPtyClient";
import type { ShortcutAction } from "./shortcuts";
import { appReducer, initialAppState } from "./state/appReducer";
import { INITIAL_RUNTIME, type PaneId, type PaneRuntime } from "./types";

const CTRL_C = "\x03";

const INITIAL_RUNTIMES: Record<PaneId, PaneRuntime> = {
  0: INITIAL_RUNTIME,
  1: INITIAL_RUNTIME,
  2: INITIAL_RUNTIME,
  3: INITIAL_RUNTIME,
};

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [runtimes, setRuntimes] = useState(INITIAL_RUNTIMES);
  const [armedPanes, setArmedPanes] = useState<ReadonlySet<PaneId>>(
    () => new Set(visiblePanes(initialAppState.layout)),
  );
  const [workspace, setWorkspace] = useState("");
  const [killTarget, setKillTarget] = useState<PaneId | null>(null);
  const handles = useRef(new Map<PaneId, PaneHandle>());
  const runtimesRef = useRef(runtimes);
  runtimesRef.current = runtimes;
  const workspaceInputRef = useRef<HTMLInputElement>(null);

  // Lazy spawn: a pane is armed the first time its layout shows it.
  useEffect(() => {
    setArmedPanes((current) => {
      const next = new Set(current);
      visiblePanes(state.layout).forEach((paneId) => next.add(paneId));
      return next.size === current.size ? current : next;
    });
  }, [state.layout]);

  // Keep keyboard focus on the active pane across moves and layout changes.
  useEffect(() => {
    if (killTarget !== null) return;
    handles.current.get(state.activePane)?.focus();
  }, [state.activePane, state.layout, killTarget]);

  const onRegister = useCallback((paneId: PaneId, handle: PaneHandle | null) => {
    if (handle) handles.current.set(paneId, handle);
    else handles.current.delete(paneId);
  }, []);

  const onRuntimeChange = useCallback((paneId: PaneId, patch: Partial<PaneRuntime>) => {
    setRuntimes((current) => ({ ...current, [paneId]: { ...current[paneId], ...patch } }));
  }, []);

  const onPaneFocus = useCallback((paneId: PaneId) => {
    dispatch({ type: "setActive", paneId });
  }, []);

  const emergencyStop = useCallback(() => {
    for (const [paneId, handle] of handles.current) {
      if (runtimesRef.current[paneId].status === "busy") handle.sendInput(CTRL_C);
    }
  }, []);

  const performKill = useCallback((paneId: PaneId) => {
    setKillTarget(null);
    handles.current.get(paneId)?.kill().catch(() => undefined);
  }, []);

  // Busy panes get a confirmation; idle ones are killed immediately (Design-doc 3.4.2).
  const requestKill = useCallback(
    (paneId: PaneId) => {
      const status = runtimesRef.current[paneId].status;
      if (status === "busy") setKillTarget(paneId);
      else if (status === "idle") performKill(paneId);
    },
    [performKill],
  );

  useGlobalShortcuts((action: ShortcutAction) => {
    switch (action.type) {
      case "focus":
      case "layout":
      case "toggleBoard":
      case "toggleHiddenList":
        dispatch(action);
        return;
      case "focusWorkspace":
        workspaceInputRef.current?.select();
        workspaceInputRef.current?.focus();
        return;
      case "emergencyStop":
        emergencyStop();
        return;
      case "killPane":
        requestKill(state.activePane);
        return;
      case "editPaneCwd":
      case "agentNewline":
        // Wired up in checkpoint 5.
        return;
    }
  });

  const hiddenEntries: HiddenPaneEntry[] = hiddenPanes(state.layout)
    .filter((paneId) => runtimes[paneId].status !== "not_started")
    .map((paneId) => ({ paneId, title: DEFAULT_PANES[paneId].title, runtime: runtimes[paneId] }));

  return (
    <div className="flex h-full flex-col">
      <GlobalToolbar
        layout={state.layout}
        onLayoutChange={(layout) => dispatch({ type: "layout", layout })}
        boardOpen={state.boardOpen}
        onToggleBoard={() => dispatch({ type: "toggleBoard" })}
        workspace={workspace}
        onWorkspaceSubmit={setWorkspace}
        workspaceInputRef={workspaceInputRef}
        onEmergencyStop={emergencyStop}
      >
        <HiddenPanesIndicator
          entries={hiddenEntries}
          open={state.hiddenListOpen}
          onToggle={() => dispatch({ type: "toggleHiddenList" })}
          onSelect={(paneId) => dispatch({ type: "showPane", paneId })}
        />
      </GlobalToolbar>
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 p-1">
          <PaneGrid
            layout={state.layout}
            renderPane={(paneId) => {
              const pane = DEFAULT_PANES[paneId];
              return (
                <TerminalPane
                  paneId={paneId}
                  title={pane.title}
                  cwd={pane.cwd ?? (workspace || null)}
                  client={tauriPtyClient}
                  armed={armedPanes.has(paneId)}
                  runtime={runtimes[paneId]}
                  onRuntimeChange={onRuntimeChange}
                  onRegister={onRegister}
                  onFocus={onPaneFocus}
                  onKillRequest={requestKill}
                />
              );
            }}
          />
        </main>
        {state.boardOpen && <AgentBoardPanel />}
      </div>
      {killTarget !== null && (
        <ConfirmDialog
          title="プロセスを終了しますか？"
          message={`${DEFAULT_PANES[killTarget].title} はコマンド実行中です。終了すると実行中の処理は失われます。`}
          confirmLabel="終了する"
          onConfirm={() => performKill(killTarget)}
          onCancel={() => setKillTarget(null)}
        />
      )}
    </div>
  );
}
