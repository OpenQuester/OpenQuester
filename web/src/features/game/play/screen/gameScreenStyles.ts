export const gameWidth = "max-w-[1320px] 3xl:max-w-[1760px] 4xl:max-w-[2240px]";

const panelButton = "inline-flex h-9 w-9 items-center justify-center rounded-sm border";

export const gameScreenStyles = {
  stage: "mx-auto flex w-full flex-1 flex-col px-3 py-4 transition-opacity sm:px-6 sm:py-6",
  header: "mx-auto flex flex-wrap items-center gap-2.5 px-3 py-2.5 sm:px-6",
  phaseBadge: "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold",
  unreadCount: "rounded-full bg-accent px-1.5 font-mono text-xs text-on-accent",
  connectionNotice:
    "mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-6",
  panels:
    "sticky top-0 flex h-dvh w-[clamp(340px,24vw,460px)] shrink-0 flex-col border-l border-line-strong bg-surface",
  panel: "flex min-h-0 flex-col border-b border-line last:border-b-0",
  panelHeader: "flex items-center gap-2 border-b border-line px-4 py-2.5",
  panelTitle: "m-0 flex-1 truncate font-display text-lg font-extrabold",
  panelButton,
  panelCloseButton: `${panelButton} border-line-strong text-text hover:bg-surface-2`,
  toasts:
    "pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+190px)] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-[120px] md:items-end",
  toast:
    "pointer-events-auto flex max-w-[560px] items-center gap-3 rounded-md border px-4 py-3 shadow-xl oq-slide-up",
  dismissToast:
    "inline-flex h-8 w-8 items-center justify-center rounded-sm text-current hover:bg-white/10",
  offlineBanner: "border-b border-danger/40 bg-danger-surface text-on-danger-surface",
  retryBanner: "border-b border-warning/30 bg-warning-surface text-on-warning-surface",
  roundName: "mr-1 max-w-[26ch] truncate text-sm text-muted",
} as const;
