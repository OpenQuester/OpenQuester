/** Shared content layouts; use the same recipe for the same role across features. */
export const layoutStyles = {
  actions: "flex flex-wrap items-center gap-2",
  spacedActions: "flex flex-wrap items-center gap-3",
  cardBody: "flex flex-col gap-4 p-5",
  optionGroup: "m-0 flex flex-col gap-2 border-0 p-0",
  compactOptionGroup: "m-0 flex flex-col gap-1.5 border-0 p-0",
  list: "m-0 flex list-none flex-col gap-2 p-0",
  spacedList: "m-0 flex list-none flex-col gap-3 p-0",
  compactList: "m-0 flex list-none flex-col gap-1.5 p-0",
  summaryRow:
    "flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-[12px] bg-surface-2 px-4 py-3",
  meterHeading: "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1",
  contentColumn: "flex min-w-0 flex-1 flex-col",
  summaryColumn: "flex min-w-0 flex-1 flex-col gap-0.5",
  wrappingField: "flex min-w-0 flex-[1_1_200px] flex-col",
  emptyState: "rounded-lg border border-dashed border-line-strong p-8 text-center text-muted",
  backLink: "inline-flex items-center gap-1.5 self-start text-muted no-underline hover:text-text",
} as const;
