export const packageOutlineStyles = {
  round: "flex w-full flex-col gap-0.5 rounded-sm border-2 px-3 py-2 text-left text-text",
  theme: "flex min-h-9 w-full items-center gap-2 rounded-[8px] border-2 px-2.5 text-left text-sm",
  finalBadge: "rounded-[6px] bg-accent-surface px-1.5 text-[11px] font-bold text-accent-strong",
  themes: "m-0 mt-0.5 mb-1.5 flex list-none flex-col gap-0.5 py-0 pr-0 pl-4",
  rounds: "m-0 flex list-none flex-col gap-1 p-0",
  details:
    "flex min-h-11 items-center gap-2.5 rounded-sm px-3 text-left font-medium text-soft hover:bg-surface-2",
  heading: "mx-3 mt-3 mb-1 text-xs font-bold tracking-[0.08em] text-faint uppercase",
  addRound:
    "mt-1.5 flex min-h-11 items-center gap-2 rounded-sm border border-dashed border-line-strong px-3 text-sm font-semibold text-muted hover:text-text",
} as const;
