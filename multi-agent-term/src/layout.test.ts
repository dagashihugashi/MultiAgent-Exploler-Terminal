import { describe, expect, it } from "vitest";
import { hiddenPanes, isVisible, layoutShowing, neighborOf, positionOf, visiblePanes } from "./layout";

describe("layout visibility", () => {
  it("shows panes 0 and 1 in 2x1 and hides 2 and 3", () => {
    expect(visiblePanes("2x1")).toEqual([0, 1]);
    expect(hiddenPanes("2x1")).toEqual([2, 3]);
    expect(isVisible("2x1", 3)).toBe(false);
  });

  it("shows every pane in 2x2 and 4x1", () => {
    expect(hiddenPanes("2x2")).toEqual([]);
    expect(hiddenPanes("4x1")).toEqual([]);
  });

  it("places pane 2 at the bottom-left of 2x2", () => {
    expect(positionOf("2x2", 2)).toEqual({ row: 1, col: 0 });
    expect(positionOf("2x1", 2)).toBeNull();
  });
});

describe("neighborOf", () => {
  it("moves horizontally in a single-row layout", () => {
    expect(neighborOf("3x1", 0, "right")).toBe(1);
    expect(neighborOf("3x1", 1, "right")).toBe(2);
    expect(neighborOf("3x1", 1, "left")).toBe(0);
  });

  it("returns null at the edges instead of wrapping", () => {
    expect(neighborOf("3x1", 0, "left")).toBeNull();
    expect(neighborOf("3x1", 2, "right")).toBeNull();
    expect(neighborOf("3x1", 1, "up")).toBeNull();
    expect(neighborOf("3x1", 1, "down")).toBeNull();
  });

  it("moves vertically in 2x2", () => {
    expect(neighborOf("2x2", 0, "down")).toBe(2);
    expect(neighborOf("2x2", 1, "down")).toBe(3);
    expect(neighborOf("2x2", 3, "up")).toBe(1);
    expect(neighborOf("2x2", 3, "left")).toBe(2);
  });

  it("returns null for a pane hidden in the current layout", () => {
    expect(neighborOf("2x1", 2, "left")).toBeNull();
  });
});

describe("layoutShowing", () => {
  it("keeps the current layout when the pane is already visible", () => {
    expect(layoutShowing(1, "2x1")).toBe("2x1");
    expect(layoutShowing(3, "4x1")).toBe("4x1");
  });

  it("picks the smallest layout that reveals a hidden pane", () => {
    expect(layoutShowing(2, "2x1")).toBe("3x1");
    expect(layoutShowing(3, "2x1")).toBe("2x2");
    expect(layoutShowing(3, "3x1")).toBe("2x2");
  });
});
