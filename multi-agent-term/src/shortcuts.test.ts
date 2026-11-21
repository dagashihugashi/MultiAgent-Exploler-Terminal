import { describe, expect, it } from "vitest";
import { normalizeCode, resolveShortcut, type KeyLike } from "./shortcuts";

const key = (code: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  code,
  altKey: false,
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});

describe("resolveShortcut", () => {
  it("maps Alt+H/J/K/L and Alt+arrows to focus moves", () => {
    expect(resolveShortcut(key("KeyH", { altKey: true }))).toEqual({ type: "focus", direction: "left" });
    expect(resolveShortcut(key("KeyJ", { altKey: true }))).toEqual({ type: "focus", direction: "down" });
    expect(resolveShortcut(key("KeyK", { altKey: true }))).toEqual({ type: "focus", direction: "up" });
    expect(resolveShortcut(key("KeyL", { altKey: true }))).toEqual({ type: "focus", direction: "right" });
    expect(resolveShortcut(key("ArrowRight", { altKey: true }))).toEqual({ type: "focus", direction: "right" });
  });

  it("maps Ctrl+Shift+1..4 to layouts using the physical digit key", () => {
    expect(resolveShortcut(key("Digit1", { ctrlKey: true, shiftKey: true }))).toEqual({ type: "layout", layout: "2x1" });
    expect(resolveShortcut(key("Digit2", { ctrlKey: true, shiftKey: true }))).toEqual({ type: "layout", layout: "2x2" });
    expect(resolveShortcut(key("Digit3", { ctrlKey: true, shiftKey: true }))).toEqual({ type: "layout", layout: "3x1" });
    expect(resolveShortcut(key("Digit4", { ctrlKey: true, shiftKey: true }))).toEqual({ type: "layout", layout: "4x1" });
  });

  it("does not implement Alt+1..4 pane jumps", () => {
    expect(resolveShortcut(key("Digit1", { altKey: true }))).toBeNull();
  });

  it("maps the toolbar and lifecycle shortcuts", () => {
    expect(resolveShortcut(key("KeyB", { altKey: true }))).toEqual({ type: "toggleBoard" });
    expect(resolveShortcut(key("KeyW", { altKey: true }))).toEqual({ type: "focusWorkspace" });
    expect(resolveShortcut(key("KeyW", { altKey: true, shiftKey: true }))).toEqual({ type: "editPaneCwd" });
    expect(resolveShortcut(key("KeyI", { altKey: true }))).toEqual({ type: "toggleHiddenList" });
    expect(resolveShortcut(key("KeyK", { ctrlKey: true, shiftKey: true }))).toEqual({ type: "emergencyStop" });
    expect(resolveShortcut(key("KeyX", { ctrlKey: true, shiftKey: true }))).toEqual({ type: "killPane" });
    expect(resolveShortcut(key("Enter", { ctrlKey: true }))).toEqual({ type: "agentNewline" });
  });

  it("leaves ordinary terminal keys alone", () => {
    expect(resolveShortcut(key("KeyC", { ctrlKey: true }))).toBeNull();
    expect(resolveShortcut(key("KeyK", { ctrlKey: true }))).toBeNull();
    expect(resolveShortcut(key("Enter"))).toBeNull();
    expect(resolveShortcut(key("Enter", { shiftKey: true }))).toBeNull();
    expect(resolveShortcut(key("KeyH"))).toBeNull();
    expect(resolveShortcut(key("KeyH", { altKey: true, ctrlKey: true }))).toBeNull();
    expect(resolveShortcut(key("KeyH", { altKey: true, metaKey: true }))).toBeNull();
  });
});

describe("normalizeCode fallback for events without a physical code", () => {
  it("prefers the real code when present", () => {
    expect(normalizeCode(key("KeyH", { key: "x" }))).toBe("KeyH");
  });

  it("derives letter and named keys from key", () => {
    expect(normalizeCode(key("", { key: "l" }))).toBe("KeyL");
    expect(normalizeCode(key("", { key: "B" }))).toBe("KeyB");
    expect(normalizeCode(key("", { key: "Enter" }))).toBe("Enter");
    expect(normalizeCode(key("", { key: "ArrowDown" }))).toBe("ArrowDown");
  });

  it("derives digits from keyCode because Shift changes key", () => {
    expect(normalizeCode(key("", { key: "@", keyCode: 50 }))).toBe("Digit2");
    expect(resolveShortcut(key("", { key: "@", keyCode: 50, ctrlKey: true, shiftKey: true }))).toEqual({
      type: "layout",
      layout: "2x2",
    });
  });

  it("derives letters from keyCode when key is a control character", () => {
    expect(normalizeCode(key("", { key: "", keyCode: 88 }))).toBe("KeyX");
    expect(resolveShortcut(key("", { key: "", keyCode: 88, ctrlKey: true, shiftKey: true }))).toEqual({
      type: "killPane",
    });
  });

  it("returns an empty code for anything else", () => {
    expect(normalizeCode(key("", { key: "ab" }))).toBe("");
    expect(resolveShortcut(key("", { key: "", altKey: true }))).toBeNull();
  });
});
