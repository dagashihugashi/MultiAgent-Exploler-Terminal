import type { PaneId } from "./types";

export type LayoutMode = "2x1" | "2x2" | "3x1" | "4x1";
export type Direction = "left" | "right" | "up" | "down";

export interface LayoutSpec {
  columns: number;
  rows: number;
  /** Pane ids in row-major grid order. */
  panes: readonly PaneId[];
}

export const LAYOUT_MODES: readonly LayoutMode[] = ["2x1", "2x2", "3x1", "4x1"];
export const ALL_PANES: readonly PaneId[] = [0, 1, 2, 3];

export const LAYOUTS: Record<LayoutMode, LayoutSpec> = {
  "2x1": { columns: 2, rows: 1, panes: [0, 1] },
  "2x2": { columns: 2, rows: 2, panes: [0, 1, 2, 3] },
  "3x1": { columns: 3, rows: 1, panes: [0, 1, 2] },
  "4x1": { columns: 4, rows: 1, panes: [0, 1, 2, 3] },
};

const DIRECTION_DELTA: Record<Direction, readonly [number, number]> = {
  left: [0, -1],
  right: [0, 1],
  up: [-1, 0],
  down: [1, 0],
};

export function visiblePanes(layout: LayoutMode): readonly PaneId[] {
  return LAYOUTS[layout].panes;
}

export function hiddenPanes(layout: LayoutMode): readonly PaneId[] {
  return ALL_PANES.filter((id) => !isVisible(layout, id));
}

export function isVisible(layout: LayoutMode, paneId: PaneId): boolean {
  return LAYOUTS[layout].panes.includes(paneId);
}

export function positionOf(
  layout: LayoutMode,
  paneId: PaneId,
): { row: number; col: number } | null {
  const spec = LAYOUTS[layout];
  const index = spec.panes.indexOf(paneId);
  if (index < 0) return null;
  return { row: Math.floor(index / spec.columns), col: index % spec.columns };
}

/** Adjacent pane in `direction`, or null at the grid edge (no wrap-around). */
export function neighborOf(
  layout: LayoutMode,
  paneId: PaneId,
  direction: Direction,
): PaneId | null {
  const spec = LAYOUTS[layout];
  const position = positionOf(layout, paneId);
  if (!position) return null;
  const [rowDelta, colDelta] = DIRECTION_DELTA[direction];
  const row = position.row + rowDelta;
  const col = position.col + colDelta;
  if (row < 0 || row >= spec.rows || col < 0 || col >= spec.columns) return null;
  return spec.panes[row * spec.columns + col] ?? null;
}
