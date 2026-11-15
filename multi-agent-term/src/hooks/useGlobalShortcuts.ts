import { useEffect, useRef } from "react";
import { resolveShortcut, type ShortcutAction } from "../shortcuts";

/**
 * Window-level (capture phase) keyboard dispatcher. Catches shortcuts before
 * xterm or the toolbar inputs see them, so Alt+W works from inside a pane.
 */
export function useGlobalShortcuts(handler: (action: ShortcutAction) => void) {
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = resolveShortcut(event);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      latest.current(action);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
