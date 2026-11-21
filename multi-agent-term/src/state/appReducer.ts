import {
  isVisible,
  layoutShowing,
  neighborOf,
  visiblePanes,
  type Direction,
  type LayoutMode,
} from "../layout";
import type { PaneId } from "../types";

export interface AppState {
  layout: LayoutMode;
  activePane: PaneId;
  boardOpen: boolean;
  hiddenListOpen: boolean;
}

export type AppAction =
  | { type: "focus"; direction: Direction }
  | { type: "layout"; layout: LayoutMode }
  | { type: "toggleBoard" }
  | { type: "toggleHiddenList" }
  | { type: "closeHiddenList" }
  | { type: "setActive"; paneId: PaneId }
  /** Bring a (possibly hidden) pane on screen and focus it. */
  | { type: "showPane"; paneId: PaneId };

export const initialAppState: AppState = {
  layout: "2x1",
  activePane: 0,
  boardOpen: false,
  hiddenListOpen: false,
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
    case "toggleHiddenList":
      return { ...state, hiddenListOpen: !state.hiddenListOpen };
    case "closeHiddenList":
      return state.hiddenListOpen ? { ...state, hiddenListOpen: false } : state;
    case "setActive":
      return state.activePane === action.paneId ? state : { ...state, activePane: action.paneId };
    case "showPane":
      return {
        ...state,
        layout: layoutShowing(action.paneId, state.layout),
        activePane: action.paneId,
        hiddenListOpen: false,
      };
  }
}
