import { useEffect, useState } from "react";
import type { PaneId, PaneRuntime, PaneStatus } from "../types";
import { formatDuration } from "../utils/formatDuration";

export interface HiddenPaneEntry {
  paneId: PaneId;
  title: string;
  runtime: PaneRuntime;
}

interface HiddenPanesIndicatorProps {
  entries: readonly HiddenPaneEntry[];
  open: boolean;
  onToggle: () => void;
  onSelect: (paneId: PaneId) => void;
}

const TICK_MS = 1000;

const STATUS_LABEL: Record<PaneStatus, string> = {
  not_started: "未起動",
  busy: "busy",
  idle: "idle",
  exited: "終了",
  error: "error",
};

const STATUS_DOT: Record<PaneStatus, string> = {
  not_started: "bg-neutral-600",
  busy: "bg-green-500",
  idle: "bg-neutral-300",
  exited: "bg-neutral-900 ring-1 ring-neutral-500",
  error: "bg-red-500",
};

/** Toolbar badge listing panes that run off-screen (Design-doc 3.4). */
export function HiddenPanesIndicator({ entries, open, onToggle, onSelect }: HiddenPanesIndicatorProps) {
  const [now, setNow] = useState(() => Date.now());
  const anyBusy = entries.some((entry) => entry.runtime.status === "busy");

  // Refresh busy durations only while the list is visible.
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [open]);

  if (entries.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        className={`flex items-center gap-1 rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-700 ${open ? "bg-neutral-700" : ""}`}
        title="非表示ペイン (Alt+I)"
        onClick={onToggle}
      >
        Hidden: {entries.length}
        {anyBusy && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />}
      </button>
      {open && (
        <ul className="absolute right-0 top-full z-20 mt-1 w-96 max-w-[90vw] rounded border border-neutral-700 bg-neutral-900 p-1 text-xs shadow-xl">
          {entries.map(({ paneId, title, runtime }) => (
            <li key={paneId}>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 rounded px-2 py-1 text-left hover:bg-neutral-800"
                onClick={() => onSelect(paneId)}
              >
                <span className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[runtime.status]}`} />
                  <span className="font-semibold">{title}</span>
                  <span className="text-neutral-400">{STATUS_LABEL[runtime.status]}</span>
                  {runtime.status === "busy" && runtime.busySince !== null && (
                    <span className="text-neutral-500">{formatDuration(now - runtime.busySince)}</span>
                  )}
                  <span className="ml-auto truncate text-neutral-500">{runtime.cwd ?? ""}</span>
                </span>
                {runtime.lastOutputLine && (
                  <span className="truncate font-mono text-neutral-400">{runtime.lastOutputLine}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
