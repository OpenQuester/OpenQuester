const optionalColumn = "hidden px-2 text-right sm:table-cell";

export const statsStyles = {
  optionalHeading: `${optionalColumn} py-3 font-medium`,
  optionalValue: `${optionalColumn} py-2.5 tabular-nums`,
  rank: "px-4 py-2.5 font-display text-lg font-bold tabular-nums",
  report: "flex flex-col gap-1.5 rounded-md border border-line p-3",
  reports: "flex min-h-0 flex-col gap-3 overflow-y-auto p-5",
  total: "flex flex-col rounded-md bg-surface-2 px-3 py-2.5",
  recentGame:
    "flex flex-wrap items-center justify-between gap-x-4 border-b border-line py-2 last:border-b-0",
  reportReason: "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3",
  reportComment: "m-0 line-clamp-3 text-sm [overflow-wrap:anywhere]",
  reportQuestion: "m-0 text-sm text-soft [overflow-wrap:anywhere]",
  reportLink: "text-sm text-muted underline-offset-2 hover:text-text hover:underline",
} as const;
