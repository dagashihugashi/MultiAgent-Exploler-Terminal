import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AgentBoardPanel } from "./components/AgentBoardPanel";
import { GlobalToolbar } from "./components/GlobalToolbar";
import { PaneGrid } from "./components/PaneGrid";
import { TerminalPane, type PaneHandle } from "./components/TerminalPane";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { visiblePanes } from "./layout";
import { DEFAULT_PANES } from "./paneDefaults";
import { tauriPtyClient } from "./pty/tauriPtyClient";
import type { ShortcutAction } from "./shortcuts";
import { appReducer, initialAppState } from "./state/appReducer";
import type { PaneId, PaneStatus } from "./types";

const CTRL_C = "\x03";

const INITIAL_STATUSES: Record<PaneId, PaneStatus> = {
  0: "not_started",
  1: "not_started",
  2: "not_started",
  3: "not_started",
};

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [statuses, setStatuses] = useState(INITIAL_STATUSES);
  const [armedPanes, setArmedPanes] = useState<ReadonlySet<PaneId>>(
    () => new Set(visiblePanes(initialAppState.layout)),
  );
  const [workspace, setWorkspace] = useState("");
  const handles = useRef(new Map<PaneId, PaneHandle>());
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;
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
    handles.current.get(state.activePane)?.focus();
  }, [state.activePane, state.layout]);

  const onRegister = useCallback((paneId: PaneId, handle: PaneHandle | null) => {
    if (handle) handles.current.set(paneId, handle);
    else handles.current.delete(paneId);
  }, []);

  const onStatusChange = useCallback((paneId: PaneId, status: PaneStatus) => {
    setStatuses((current) => ({ ...current, [paneId]: status }));
  }, []);

  const onPaneFocus = useCallback((paneId: PaneId) => {
    dispatch({ type: "setActive", paneId });
  }, []);

  const emergencyStop = useCallback(() => {
    for (const [paneId, handle] of handles.current) {
      if (statusesRef.current[paneId] === "running") handle.sendInput(CTRL_C);
    }
  }, []);

  useGlobalShortcuts((action: ShortcutAction) => {
    switch (action.type) {
      case "focus":
      case "layout":
      case "toggleBoard":
        dispatch(action);
        return;
      case "focusWorkspace":
        workspaceInputRef.current?.select();
        workspaceInputRef.current?.focus();
        return;
      case "emergencyStop":
        emergencyStop();
        return;
      case "editPaneCwd":
      case "toggleHiddenList":
      case "killPane":
      case "agentNewline":
        // Wired up in checkpoints 3 and 5.
        return;
    }
  });

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
      />
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
                  status={statuses[paneId]}
                  onStatusChange={onStatusChange}
                  onRegister={onRegister}
                  onFocus={onPaneFocus}
                />
              );
            }}
          />
        </main>
        {state.boardOpen && <AgentBoardPanel />}
      </div>
    </div>
  );
}
