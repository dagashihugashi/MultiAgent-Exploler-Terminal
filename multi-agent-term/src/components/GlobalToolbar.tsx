import { useState, type ReactNode, type RefObject } from "react";
import { LAYOUT_MODES, type LayoutMode } from "../layout";

interface GlobalToolbarProps {
  layout: LayoutMode;
  onLayoutChange: (layout: LayoutMode) => void;
  boardOpen: boolean;
  onToggleBoard: () => void;
  workspace: string;
  onWorkspaceSubmit: (path: string) => void;
  workspaceInputRef: RefObject<HTMLInputElement>;
  onEmergencyStop: () => void;
  /** Extra controls (hidden-pane indicator) rendered after the layout buttons. */
  children?: ReactNode;
}

const BUTTON = "rounded px-2 py-0.5 text-xs hover:bg-neutral-700";
const ACTIVE = "bg-blue-600 text-white hover:bg-blue-600";

export function GlobalToolbar(props: GlobalToolbarProps) {
  const [draft, setDraft] = useState(props.workspace);

  return (
    <div className="flex items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-2 py-1 text-neutral-200">
      <form
        className="flex items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          props.onWorkspaceSubmit(draft.trim());
        }}
      >
        <span className="text-xs text-neutral-400">📁 Workspace</span>
        <input
          ref={props.workspaceInputRef}
          className="w-72 rounded border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-xs outline-none focus:border-blue-500"
          placeholder="C:\work  (Alt+W)"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className={`${BUTTON} border border-neutral-700`}>
          Apply
        </button>
      </form>

      <span className="h-4 w-px bg-neutral-700" />

      <div className="flex items-center gap-1">
        <span className="text-xs text-neutral-400">Layout</span>
        {LAYOUT_MODES.map((mode, index) => (
          <button
            key={mode}
            type="button"
            className={`${BUTTON} ${mode === props.layout ? ACTIVE : ""}`}
            title={`Ctrl+Shift+${index + 1}`}
            onClick={() => props.onLayoutChange(mode)}
          >
            {mode}
          </button>
        ))}
      </div>

      {props.children}

      <span className="h-4 w-px bg-neutral-700" />

      <button
        type="button"
        className={`${BUTTON} border border-red-900 text-red-300`}
        title="全ペインへ Ctrl+C (Ctrl+Shift+K)"
        onClick={props.onEmergencyStop}
      >
        ■ Stop All
      </button>

      <button
        type="button"
        className={`${BUTTON} ml-auto ${props.boardOpen ? ACTIVE : ""}`}
        title="Alt+B"
        onClick={props.onToggleBoard}
      >
        📋 Board
      </button>
    </div>
  );
}
