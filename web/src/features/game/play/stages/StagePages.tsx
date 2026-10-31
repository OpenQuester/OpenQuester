import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import { Pagination } from "@/ui/Pagination";

/** Keep choices usable in the space left by a growing header or dock. */
export function StagePages({
  children,
  itemHeight = 72,
  itemWidth = 260,
  columns: fixedColumns,
  role,
  label,
  fill = false,
}: {
  children: ReactNode[];
  itemHeight?: number;
  itemWidth?: number;
  columns?: number;
  role?: "radiogroup" | "rowgroup" | "list";
  label?: string;
  fill?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [page, setPage] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry!.contentRect.width, height: entry!.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const columns = fixedColumns ?? Math.max(1, Math.floor((size.width + 8) / (itemWidth + 8)));
  const allRows = Math.ceil(children.length / columns);
  const fits = allRows * (itemHeight + 8) - 8 <= size.height;
  const rows = Math.max(1, Math.floor((size.height - (fits ? 0 : 48) + 8) / (itemHeight + 8)));
  const capacity = size.height ? rows * columns : children.length || 1;
  const pages = Math.ceil(children.length / capacity);
  const visiblePage = Math.min(page, Math.max(0, pages - 1));
  const visible = children.slice(visiblePage * capacity, (visiblePage + 1) * capacity);
  const isRadio = (child: ReactNode) =>
    isValidElement<{ "aria-checked"?: boolean; tabIndex?: number }>(child);
  const hasSelection = visible.some((child) => isRadio(child) && child.props["aria-checked"]);
  const Grid = role === "list" ? "ul" : "div";
  return (
    <div ref={ref} className="stage-pages" data-testid="stage-pages">
      <Grid
        role={role}
        aria-label={label}
        className="stage-page-grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${Math.ceil(visible.length / columns) || 1}, minmax(0, ${fill ? "1fr" : `${itemHeight}px`}))`,
        }}
      >
        {visible.map((child, index) =>
          role === "radiogroup" && isRadio(child)
            ? cloneElement(child, {
                tabIndex: child.props["aria-checked"] || (!hasSelection && index === 0) ? 0 : -1,
              })
            : child,
        )}
      </Grid>
      <Pagination
        page={visiblePage}
        pages={pages}
        setPage={(value) => setPage(typeof value === "function" ? value(visiblePage) : value)}
      />
    </div>
  );
}
