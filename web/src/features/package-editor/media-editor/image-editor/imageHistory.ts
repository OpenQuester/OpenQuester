import { initialImageEdits, type ImageEdits } from "../mediaEdits";

export type ImageHistory = { past: ImageEdits[]; now: ImageEdits; future: ImageEdits[] };
type HistoryAction = { type: "commit"; edits: ImageEdits } | { type: "undo" | "redo" };

export const initialImageHistory = (): ImageHistory => ({
  past: [],
  now: initialImageEdits(),
  future: [],
});

export function imageHistoryReducer(history: ImageHistory, action: HistoryAction): ImageHistory {
  switch (action.type) {
    case "commit":
      return JSON.stringify(history.now) === JSON.stringify(action.edits)
        ? history
        : { past: [...history.past.slice(-99), history.now], now: action.edits, future: [] };
    case "undo":
      return history.past.length
        ? {
            past: history.past.slice(0, -1),
            now: history.past[history.past.length - 1]!,
            future: [history.now, ...history.future],
          }
        : history;
    case "redo":
      return history.future.length
        ? {
            past: [...history.past, history.now],
            now: history.future[0]!,
            future: history.future.slice(1),
          }
        : history;
  }
}
