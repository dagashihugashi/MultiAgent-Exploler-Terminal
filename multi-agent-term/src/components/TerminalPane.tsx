import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { PtyClient } from "../pty/PtyClient";
import { resolveShortcut } from "../shortcuts";
import type { PaneId, PaneStatus } from "../types";
import { debounce } from "../utils/debounce";

const RESIZE_DEBOUNCE_MS = 150;

/** Imperative surface the app uses to drive a mounted pane. */
export interface PaneHandle {
  focus(): void;
  sendInput(data: string): void;
}

interface TerminalPaneProps {
  paneId: PaneId;
  title: string;
  cwd: string | null;
  client: PtyClient;
  /** False until the pane has been visible once: lazy spawn (Design-doc 3.4.2). */
  armed: boolean;
  status: PaneStatus;
  onStatusChange: (paneId: PaneId, status: PaneStatus) => void;
  onRegister: (paneId: PaneId, handle: PaneHandle | null) => void;
  onFocus: (paneId: PaneId) => void;
}

const STATUS_DOT: Record<PaneStatus, string> = {
  not_started: "bg-neutral-600",
  running: "bg-green-500",
  exited: "bg-neutral-900 ring-1 ring-neutral-500",
  error: "bg-red-500",
};

const ignore = () => undefined;

export function TerminalPane(props: TerminalPaneProps) {
  const { paneId, title, cwd, client, armed, status } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [generation, setGeneration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Latest callbacks/config without re-running the effects below.
  const latest = useRef(props);
  latest.current = props;

  // Terminal instance: created once per pane and kept across restarts.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily: '"Cascadia Mono", Consolas, "MS Gothic", monospace',
      fontSize: 14,
      cursorBlink: true,
      scrollback: 5000,
      theme: { background: "#0a0a0a" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    // App-level shortcuts never reach the shell.
    term.attachCustomKeyEventHandler((event) => resolveShortcut(event) === null);
    termRef.current = term;
    fitRef.current = fit;

    latest.current.onRegister(paneId, {
      focus: () => term.focus(),
      sendInput: (data) => client.write(paneId, data).catch(ignore),
    });

    // Hidden panes report a 0x0 box; never fit/resize to zero (Design-doc 3.4.4).
    const applyResize = debounce(() => {
      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      fit.fit();
      client.resize(paneId, term.rows, term.cols).catch(ignore);
    }, RESIZE_DEBOUNCE_MS);
    const observer = new ResizeObserver(() => applyResize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      applyResize.cancel();
      latest.current.onRegister(paneId, null);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [paneId, client]);

  // PTY session: one per generation, started only once the pane is armed.
  useEffect(() => {
    const term = termRef.current;
    const fit = fitRef.current;
    if (!armed || !term || !fit) return;

    let disposed = false;
    const fail = (error: unknown) => {
      if (disposed) return;
      setErrorMessage(String(error));
      latest.current.onStatusChange(paneId, "error");
    };

    fit.fit();
    client
      .spawn(paneId, term.rows, term.cols, latest.current.cwd, (event) => {
        if (disposed) return;
        if (event.type === "Data") {
          term.write(event.payload);
          return;
        }
        term.write("\r\n\x1b[90m[process exited]\x1b[0m\r\n");
        latest.current.onStatusChange(paneId, "exited");
      })
      .then(() => {
        if (disposed) return;
        setErrorMessage(null);
        latest.current.onStatusChange(paneId, "running");
      })
      .catch(fail);

    const input = term.onData((data) => {
      client.write(paneId, data).catch(fail);
    });

    return () => {
      disposed = true;
      input.dispose();
      client.kill(paneId).catch(ignore);
    };
  }, [armed, generation, paneId, client]);

  const restart = useCallback(async () => {
    await client.kill(paneId).catch(ignore);
    termRef.current?.reset();
    setGeneration((current) => current + 1);
  }, [client, paneId]);

  return (
    <section
      className="flex h-full min-h-0 flex-col border-2 border-neutral-800 focus-within:border-blue-500"
      onFocusCapture={() => latest.current.onFocus(paneId)}
    >
      <header className="flex items-center gap-2 bg-neutral-900 px-2 py-1 text-xs text-neutral-300">
        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
        <span className="shrink-0 font-semibold">{title}</span>
        <span className="truncate text-neutral-500">{cwd ?? ""}</span>
        {errorMessage && <span className="truncate text-red-400">{errorMessage}</span>}
        <span className="ml-auto flex shrink-0 gap-1">
          <button
            type="button"
            className="rounded px-1 hover:bg-neutral-700 disabled:opacity-40"
            title="再起動"
            disabled={status === "not_started"}
            onClick={() => void restart()}
          >
            ↻
          </button>
          <button
            type="button"
            className="rounded px-1 hover:bg-neutral-700 disabled:opacity-40"
            title="終了（checkpoint 3 で有効化）"
            disabled
          >
            ✕
          </button>
        </span>
      </header>
      <div ref={containerRef} className="min-h-0 flex-1 p-1" />
    </section>
  );
}
