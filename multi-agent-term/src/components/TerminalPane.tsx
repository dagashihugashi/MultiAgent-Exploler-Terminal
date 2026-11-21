import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { PtyClient } from "../pty/PtyClient";
import { isPromptStart, lastNonEmptyLine, OSC_CONEMU, OSC_PROMPT, parseCwd } from "../shellIntegration";
import { resolveShortcut } from "../shortcuts";
import type { PaneId, PaneRuntime, PaneStatus } from "../types";
import { debounce } from "../utils/debounce";

const RESIZE_DEBOUNCE_MS = 150;
const LAST_LINE_DEBOUNCE_MS = 500;
const ENTER = "\r";

/** Imperative surface the app uses to drive a mounted pane. */
export interface PaneHandle {
  focus(): void;
  sendInput(data: string): void;
  kill(): Promise<void>;
}

interface TerminalPaneProps {
  paneId: PaneId;
  title: string;
  cwd: string | null;
  client: PtyClient;
  /** False until the pane has been visible once: lazy spawn (Design-doc 3.4.2). */
  armed: boolean;
  runtime: PaneRuntime;
  onRuntimeChange: (paneId: PaneId, patch: Partial<PaneRuntime>) => void;
  onRegister: (paneId: PaneId, handle: PaneHandle | null) => void;
  onFocus: (paneId: PaneId) => void;
  onKillRequest: (paneId: PaneId) => void;
}

const STATUS_DOT: Record<PaneStatus, string> = {
  not_started: "bg-neutral-600",
  busy: "bg-green-500",
  idle: "bg-neutral-300",
  exited: "bg-neutral-900 ring-1 ring-neutral-500",
  error: "bg-red-500",
};

const STATUS_TITLE: Record<PaneStatus, string> = {
  not_started: "未起動",
  busy: "実行中",
  idle: "プロンプト待ち",
  exited: "終了済み（↻ で再起動）",
  error: "エラー",
};

const ignore = () => undefined;

export function TerminalPane(props: TerminalPaneProps) {
  const { paneId, title, cwd, client, armed, runtime } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  // True only while a PTY session exists; input after a kill is dropped.
  const sessionAliveRef = useRef(false);
  const [generation, setGeneration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Latest props without re-running the effects below.
  const latest = useRef(props);
  latest.current = props;

  const report = useCallback(
    (patch: Partial<PaneRuntime>) => latest.current.onRuntimeChange(paneId, patch),
    [paneId],
  );
  const setStatus = useCallback(
    (status: PaneStatus) => {
      if (latest.current.runtime.status === status) return;
      report({ status, busySince: status === "busy" ? Date.now() : null });
    },
    [report],
  );

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
    term.attachCustomKeyEventHandler((event) => resolveShortcut(event) === null);
    termRef.current = term;
    fitRef.current = fit;

    // Shell integration (Design-doc 3.4.3).
    const promptHandler = term.parser.registerOscHandler(OSC_PROMPT, (payload) => {
      if (isPromptStart(payload)) setStatus("idle");
      return true;
    });
    const cwdHandler = term.parser.registerOscHandler(OSC_CONEMU, (payload) => {
      const next = parseCwd(payload);
      if (next !== null) report({ cwd: next });
      return next !== null;
    });
    const updateLastLine = debounce(
      () => report({ lastOutputLine: lastNonEmptyLine(term.buffer.active) }),
      LAST_LINE_DEBOUNCE_MS,
    );
    const parsedSub = term.onWriteParsed(() => updateLastLine());

    latest.current.onRegister(paneId, {
      focus: () => term.focus(),
      sendInput: (data) => client.write(paneId, data).catch(ignore),
      kill: () => {
        sessionAliveRef.current = false;
        return client.kill(paneId);
      },
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
      updateLastLine.cancel();
      parsedSub.dispose();
      promptHandler.dispose();
      cwdHandler.dispose();
      latest.current.onRegister(paneId, null);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [paneId, client, report, setStatus]);

  // PTY session: one per generation, started only once the pane is armed.
  useEffect(() => {
    const term = termRef.current;
    const fit = fitRef.current;
    if (!armed || !term || !fit) return;

    let disposed = false;
    const fail = (error: unknown) => {
      if (disposed) return;
      setErrorMessage(String(error));
      setStatus("error");
    };

    fit.fit();
    client
      .spawn(paneId, term.rows, term.cols, latest.current.cwd, (event) => {
        if (disposed) return;
        if (event.type === "Data") {
          term.write(event.payload);
          return;
        }
        sessionAliveRef.current = false;
        term.write("\r\n\x1b[90m[process exited]\x1b[0m\r\n");
        setStatus("exited");
      })
      .then(() => {
        if (disposed) return;
        sessionAliveRef.current = true;
        setErrorMessage(null);
        setStatus("busy");
      })
      .catch(fail);

    const input = term.onData((data) => {
      if (!sessionAliveRef.current) return;
      // Enter at an idle prompt starts a command; the next OSC 133;A ends it.
      if (data.includes(ENTER) && latest.current.runtime.status === "idle") setStatus("busy");
      client.write(paneId, data).catch((error: unknown) => {
        // A write racing a kill fails with "no session"; that is not an error state.
        if (sessionAliveRef.current) fail(error);
      });
    });

    return () => {
      disposed = true;
      sessionAliveRef.current = false;
      input.dispose();
      client.kill(paneId).catch(ignore);
    };
  }, [armed, generation, paneId, client, setStatus]);

  const restart = useCallback(async () => {
    await client.kill(paneId).catch(ignore);
    termRef.current?.reset();
    report({ cwd: null, lastOutputLine: "" });
    setGeneration((current) => current + 1);
  }, [client, paneId, report]);

  const alive = runtime.status === "busy" || runtime.status === "idle";

  return (
    <section
      className="flex h-full min-h-0 flex-col border-2 border-neutral-800 focus-within:border-blue-500"
      onFocusCapture={() => latest.current.onFocus(paneId)}
    >
      <header className="flex items-center gap-2 bg-neutral-900 px-2 py-1 text-xs text-neutral-300">
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[runtime.status]}`}
          title={STATUS_TITLE[runtime.status]}
        />
        <span className="shrink-0 font-semibold">{title}</span>
        <span className="truncate text-neutral-500" title={runtime.cwd ?? cwd ?? ""}>
          {runtime.cwd ?? cwd ?? ""}
        </span>
        {errorMessage && <span className="truncate text-red-400">{errorMessage}</span>}
        <span className="ml-auto flex shrink-0 gap-1">
          <button
            type="button"
            className="rounded px-1 hover:bg-neutral-700 disabled:opacity-40"
            title="再起動"
            disabled={runtime.status === "not_started"}
            onClick={() => void restart()}
          >
            ↻
          </button>
          <button
            type="button"
            className="rounded px-1 hover:bg-neutral-700 disabled:opacity-40"
            title="プロセスを終了 (Ctrl+Shift+X)"
            disabled={!alive}
            onClick={() => latest.current.onKillRequest(paneId)}
          >
            ✕
          </button>
        </span>
      </header>
      <div ref={containerRef} className="min-h-0 flex-1 p-1" />
    </section>
  );
}
