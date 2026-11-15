import { isVisible, neighborOf, visiblePanes, type Direction, type LayoutMode } from "../layout";
import type { PaneId } from "../types";

export interface AppState {
  layout: LayoutMode;
  activePane: PaneId;
  boardOpen: boolean;
}

export type AppAction =
  | { type: "focus"; direction: Direction }
  | { type: "layout"; layout: LayoutMode }
  | { type: "toggleBoard" }
  | { type: "setActive"; paneId: PaneId };

export const initialAppState: AppState = {
  layout: "2x1",
  activePane: 0,
  boardOpen: false,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "focus": {
      const next = neighborOf(state.layout, state.activePane, action.direction);
      return next === null ? state : { ...state, activePane: next };
    }
    case "layout": {
      if (action.layout === state.layout) return state;
      const activePane = isVisible(action.layout, state.activePane)
        ? state.activePane
        : visiblePanes(action.layout)[0];
      return { ...state, layout: action.layout, activePane };
    }
    case "toggleBoard":
      return { ...state, boardOpen: !state.boardOpen };
    case "setActive":
      return state.activePane === action.paneId ? state : { ...state, activePane: action.paneId };
  }
}
