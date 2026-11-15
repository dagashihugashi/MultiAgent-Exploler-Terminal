import type { ReactNode } from "react";
import { ALL_PANES, LAYOUTS, positionOf, type LayoutMode } from "../layout";
import type { PaneId } from "../types";

interface PaneGridProps {
  layout: LayoutMode;
  renderPane: (paneId: PaneId) => ReactNode;
}

/**
 * CSS grid over all four panes. Panes outside the current layout stay mounted
 * (so xterm buffers and PTYs survive) but are hidden with display:none.
 */
export function PaneGrid({ layout, renderPane }: PaneGridProps) {
  const spec = LAYOUTS[layout];
  return (
    <div
      className="grid h-full min-h-0 gap-1"
      style={{
        gridTemplateColumns: `repeat(${spec.columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${spec.rows}, minmax(0, 1fr))`,
      }}
    >
      {ALL_PANES.map((paneId) => {
        const position = positionOf(layout, paneId);
        return (
          <div
            key={paneId}
            className={position ? "min-h-0 min-w-0" : "hidden"}
            style={position ? { gridRow: position.row + 1, gridColumn: position.col + 1 } : undefined}
          >
            {renderPane(paneId)}
          </div>
        );
      })}
    </div>
  );
}
