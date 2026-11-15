import type { Direction, LayoutMode } from "./layout";

/** Keyboard actions from Design-doc 3.2. */
export type ShortcutAction =
  | { type: "focus"; direction: Direction }
  | { type: "layout"; layout: LayoutMode }
  | { type: "toggleBoard" }
  | { type: "focusWorkspace" }
  | { type: "editPaneCwd" }
  | { type: "toggleHiddenList" }
  | { type: "emergencyStop" }
  | { type: "killPane" }
  | { type: "agentNewline" };

/** The subset of KeyboardEvent the resolver needs; keeps tests DOM-free. */
export interface KeyLike {
  code: string;
  /** Used only when `code` is empty (synthesized input, some remote desktops). */
  key?: string;
  keyCode?: number;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

const KEY_NAME_CODES: Record<string, string> = {
  Enter: "Enter",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
};

const DIGIT_0_KEYCODE = 48;
const DIGIT_9_KEYCODE = 57;

/** Physical key code, reconstructed from key/keyCode when the event has none. */
export function normalizeCode(event: KeyLike): string {
  if (event.code) return event.code;
  const key = event.key ?? "";
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (KEY_NAME_CODES[key]) return KEY_NAME_CODES[key];
  const keyCode = event.keyCode ?? 0;
  if (keyCode >= DIGIT_0_KEYCODE && keyCode <= DIGIT_9_KEYCODE) {
    return `Digit${keyCode - DIGIT_0_KEYCODE}`;
  }
  return "";
}

const FOCUS_KEYS: Record<string, Direction> = {
  KeyH: "left",
  KeyJ: "down",
  KeyK: "up",
  KeyL: "right",
  ArrowLeft: "left",
  ArrowDown: "down",
  ArrowUp: "up",
  ArrowRight: "right",
};

const LAYOUT_KEYS: Record<string, LayoutMode> = {
  Digit1: "2x1",
  Digit2: "2x2",
  Digit3: "3x1",
  Digit4: "4x1",
};

const ALT_KEYS: Record<string, ShortcutAction> = {
  KeyB: { type: "toggleBoard" },
  KeyW: { type: "focusWorkspace" },
  KeyI: { type: "toggleHiddenList" },
};

const CTRL_SHIFT_KEYS: Record<string, ShortcutAction> = {
  KeyK: { type: "emergencyStop" },
  KeyX: { type: "killPane" },
};

function resolveAlt(code: string, shiftKey: boolean): ShortcutAction | null {
  if (shiftKey) {
    return code === "KeyW" ? { type: "editPaneCwd" } : null;
  }
  const direction = FOCUS_KEYS[code];
  if (direction) return { type: "focus", direction };
  return ALT_KEYS[code] ?? null;
}

function resolveCtrlShift(code: string): ShortcutAction | null {
  const layout = LAYOUT_KEYS[code];
  if (layout) return { type: "layout", layout };
  return CTRL_SHIFT_KEYS[code] ?? null;
}

/** Maps a key event to an app action, or null when the key belongs to the terminal. */
export function resolveShortcut(event: KeyLike): ShortcutAction | null {
  if (event.metaKey) return null;
  const code = normalizeCode(event);
  if (event.altKey && !event.ctrlKey) return resolveAlt(code, event.shiftKey);
  if (event.ctrlKey && event.shiftKey && !event.altKey) return resolveCtrlShift(code);
  if (event.ctrlKey && !event.shiftKey && !event.altKey && code === "Enter") {
    return { type: "agentNewline" };
  }
  return null;
}
