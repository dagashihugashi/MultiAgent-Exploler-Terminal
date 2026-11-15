import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { PtyClient } from "../pty/PtyClient";
import { debounce } from "../utils/debounce";

const RESIZE_DEBOUNCE_MS = 150;

type PaneStatus = "starting" | "running" | "exited" | "error";

interface TerminalPaneProps {
  paneId: number;
  title: string;
  cwd: string | null;
  client: PtyClient;
}

const STATUS_DOT: Record<PaneStatus, string> = {
  starting: "bg-neutral-500",
  running: "bg-green-500",
  exited: "bg-neutral-700",
  error: "bg-red-500",
};

export function TerminalPane({ paneId, title, cwd, client }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<PaneStatus>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    fit.fit();

    let disposed = false;
    const reportError = (error: unknown) => {
      if (disposed) return;
      setStatus("error");
      setErrorMessage(String(error));
    };

    client
      .spawn(paneId, term.rows, term.cols, cwd, (event) => {
        if (event.type === "Data") {
          term.write(event.payload);
          return;
        }
        term.write("\r\n\x1b[90m[process exited]\x1b[0m\r\n");
        if (!disposed) setStatus("exited");
      })
      .then(() => {
        if (!disposed) setStatus("running");
      })
      .catch(reportError);

    const inputSubscription = term.onData((data) => {
      client.write(paneId, data).catch(reportError);
    });

    // Hidden panes report a 0x0 box; never fit/resize to zero (Design-doc 3.4.4).
    const applyResize = debounce(() => {
      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      fit.fit();
      client.resize(paneId, term.rows, term.cols).catch(reportError);
    }, RESIZE_DEBOUNCE_MS);
    const observer = new ResizeObserver(() => applyResize());
    observer.observe(container);

    return () => {
      disposed = true;
      observer.disconnect();
      applyResize.cancel();
      inputSubscription.dispose();
      term.dispose();
      client.kill(paneId).catch(() => undefined);
    };
  }, [paneId, cwd, client]);

  return (
    <section className="flex h-full min-h-0 flex-col border-2 border-neutral-800 focus-within:border-blue-500">
      <header className="flex items-center gap-2 bg-neutral-900 px-2 py-1 text-xs text-neutral-300">
        <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
        <span className="font-semibold">{title}</span>
        <span className="truncate text-neutral-500">{cwd ?? ""}</span>
        {errorMessage && <span className="ml-auto truncate text-red-400">{errorMessage}</span>}
      </header>
      <div ref={containerRef} className="min-h-0 flex-1 p-1" />
    </section>
  );
}
