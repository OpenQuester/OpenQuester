const seat = "flex min-h-[76px] items-center gap-3 rounded-md border p-3.5";

export const lobbyStyles = {
  panel: "rounded-lg border border-line bg-surface p-5 sm:p-6",
  actionPanel: "rounded-lg border border-line-strong bg-surface-2 p-5 sm:p-6",
  actionTitle: "m-0 text-lg font-semibold",
  slotAction:
    "inline-flex h-9 w-9 items-center justify-center rounded-sm border border-line-strong text-muted",
  inviteCode:
    "min-h-11 min-w-0 flex-1 rounded-[12px] border border-line-strong bg-bg px-3 font-mono text-sm text-text",
  actions: "order-first flex min-w-0 flex-[1_1_320px] flex-col gap-4 lg:order-none",
  checklist: "m-0 flex list-none flex-col gap-2.5 p-0 text-[15px]",
  header: "mx-auto flex max-w-[1240px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6",
  codeBadge: "rounded-sm bg-surface-2 px-3 py-1.5 text-sm text-muted",
  content:
    "mx-auto flex w-full max-w-[1240px] flex-1 flex-wrap items-start gap-6 px-4 pb-16 pt-6 sm:px-6 sm:pt-8",
  phase: "m-0 text-sm font-semibold uppercase tracking-[0.08em] text-muted",
  metadata: "flex flex-wrap items-center gap-x-3 gap-y-1 text-muted",
  seats: "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-3 p-0",
  seat,
  emptySeat: `${seat} w-full border-dashed border-line-strong bg-transparent text-left text-muted enabled:hover:border-info disabled:cursor-default`,
  emptyAvatar:
    "inline-flex h-11 w-11 items-center justify-center rounded-full bg-avatar font-semibold",
  mainColumn: "flex min-w-0 flex-[999_1_560px] flex-col gap-6",
} as const;
