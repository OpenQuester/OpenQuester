import { useEffect, useRef, useState, type RefObject } from "react";
import type { BoardTheme } from "@/game/protocol";

/** Size the board from its available width, including uneven theme rows. */
export function useBoardLayout(themes: BoardTheme[]) {
  const columns = Math.max(1, ...themes.map((th) => th.questions.length));
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  // A theme name column plus one column per price only works while every cell
  // keeps a usable width. Otherwise each theme gets its own block: the name on
  // top, prices wrapping underneath.
  const stacked = width > 0 && (width < 560 || (width - 240 - columns * 10) / columns < 80);
  // In stacked mode, spread prices evenly over rows (10 → 5 + 5, not 9 + 1).
  const perRowMax = Math.max(1, Math.floor((width - 16 + 8) / (88 + 8)));
  const rows = Math.ceil(columns / perRowMax);
  const perRow = Math.ceil(columns / rows);

  return { ref, columns, stacked, perRow };
}

function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
