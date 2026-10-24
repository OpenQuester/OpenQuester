export const uploadStyles = {
  dropZone:
    "flex flex-col items-center gap-4 rounded-lg border-2 border-dashed px-5 py-10 text-center sm:py-14",
  dropIcon: "grid size-16 place-items-center rounded-full bg-surface-2 text-accent",
  file: "flex flex-col gap-1.5 rounded-[12px] bg-surface-2 px-3 py-2",
  reviewActions:
    "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] bg-surface-2 px-4 py-3",
  importHelp: "m-0 max-w-[46ch] text-sm text-muted",
  failureMessage: "m-0 font-semibold text-danger [overflow-wrap:anywhere]",
  progressFill: "h-full rounded-full bg-accent transition-[width]",
  fileSummary: "flex min-w-0 flex-[1_1_220px] flex-col gap-0.5",
} as const;
