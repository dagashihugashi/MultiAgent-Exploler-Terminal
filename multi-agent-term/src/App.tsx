import { TerminalPane } from "./components/TerminalPane";
import { tauriPtyClient } from "./pty/tauriPtyClient";

// Checkpoint 1: a single full-window pane proving the PTY pipeline end to end.
export default function App() {
  return (
    <main className="h-full p-1">
      <TerminalPane paneId={0} title="Pane 0" cwd={null} client={tauriPtyClient} />
    </main>
  );
}
