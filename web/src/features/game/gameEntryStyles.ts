const messageCard = "flex flex-col gap-4 rounded-lg border p-6";

export const gameEntryStyles = {
  takeoverOverlay: "fixed inset-0 z-50 flex items-center justify-center bg-scrim/80 p-4",
  takeoverMessage: `${messageCard} w-full max-w-[460px] border-line-strong bg-surface shadow-2xl`,
  title:
    "m-0 font-display text-[clamp(28px,5vw,40px)] font-extrabold tracking-tight [overflow-wrap:anywhere]",
  backLink: "inline-flex min-h-11 items-center gap-2 text-muted no-underline",
  joinForm: "flex flex-col gap-6 rounded-lg border border-line bg-surface p-6 sm:p-8",
} as const;
