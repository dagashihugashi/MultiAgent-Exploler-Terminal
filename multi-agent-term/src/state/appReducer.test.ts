import { describe, expect, it } from "vitest";
import { appReducer, initialAppState, type AppState } from "./appReducer";

describe("appReducer", () => {
  it("moves focus to the neighbouring pane and ignores edge moves", () => {
    const moved = appReducer(initialAppState, { type: "focus", direction: "right" });
    expect(moved.activePane).toBe(1);

    const unchanged = appReducer(moved, { type: "focus", direction: "right" });
    expect(unchanged).toBe(moved);
  });

  it("keeps the active pane when it stays visible after a layout change", () => {
    const state: AppState = { ...initialAppState, layout: "2x2", activePane: 1 };
    const next = appReducer(state, { type: "layout", layout: "2x1" });
    expect(next.layout).toBe("2x1");
    expect(next.activePane).toBe(1);
  });

  it("falls back to the first visible pane when the active pane gets hidden", () => {
    const state: AppState = { ...initialAppState, layout: "2x2", activePane: 3 };
    const next = appReducer(state, { type: "layout", layout: "3x1" });
    expect(next.activePane).toBe(0);
  });

  it("returns the same state object for a no-op layout change", () => {
    expect(appReducer(initialAppState, { type: "layout", layout: "2x1" })).toBe(initialAppState);
  });

  it("toggles the board and sets the active pane", () => {
    const open = appReducer(initialAppState, { type: "toggleBoard" });
    expect(open.boardOpen).toBe(true);
    expect(appReducer(open, { type: "toggleBoard" }).boardOpen).toBe(false);
    expect(appReducer(initialAppState, { type: "setActive", paneId: 2 }).activePane).toBe(2);
  });
});
