/** Cards and their add/drop placeholder share the same minimum height. */
export const questionCardHeight = (cards: boolean) => (cards ? "min-h-[150px]" : "min-h-[84px]");

const insertionMarker = "absolute z-10 rounded-full bg-accent";
const accentBadge = "bg-accent-surface font-bold text-accent-strong";

export const packageBoardStyles = {
  question:
    "flex h-full w-full flex-col items-stretch gap-1.5 rounded-md border-2 p-2.5 text-left text-text",
  questionType: `self-start rounded-[6px] px-1.5 py-0.5 text-[11px] ${accentBadge}`,
  questionAnswer:
    "mt-auto line-clamp-2 rounded-[8px] px-2 py-1 text-[12px] font-semibold [overflow-wrap:anywhere]",
  roundTitle: "-ml-1.5 font-display text-[clamp(24px,3vw,34px)] font-extrabold tracking-tight",
  finalBadge: `rounded-[8px] px-2.5 py-1 text-sm ${accentBadge}`,
  roundActions: "flex rounded-[12px] border border-line bg-surface p-1",
  roundAction:
    "min-h-9 rounded-[9px] px-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:text-ghost",
  theme:
    "relative flex flex-col gap-2.5 rounded-lg border bg-surface p-3 md:grid md:grid-cols-[200px_1fr] md:gap-3",
  themeInsertion: `${insertionMarker} inset-x-2 h-1`,
  questionInsertion: `${insertionMarker} top-1 bottom-1 w-1`,
  themeHeading: "flex min-w-0 items-start gap-1 md:flex-col md:items-stretch",
  themeTitle: "flex min-w-0 flex-1 items-center gap-1 md:flex-none",
  themeDragHandle:
    "hidden h-9 w-6 shrink-0 cursor-grab items-center justify-center text-faint hover:text-text md:inline-flex",
  themeHint: "hidden px-1.5 text-xs text-faint md:block md:pl-8",
  addQuestion:
    "flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed text-sm font-semibold",
  emptyRound:
    "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-line-strong px-5 py-10 text-center",
  hoverPreview:
    "pointer-events-none fixed z-[65] max-h-[calc(100vh-16px)] w-[min(340px,calc(100vw-16px))] overflow-hidden rounded-md border border-line-strong bg-surface p-4 shadow-2xl oq-pop",
  questionPrice: "font-display text-[22px] leading-none font-extrabold",
  roundSummary: "flex min-w-0 flex-[1_1_160px] flex-col gap-1",
  emptyThemeHelp: "m-0 max-w-[44ch] text-sm text-muted",
} as const;
