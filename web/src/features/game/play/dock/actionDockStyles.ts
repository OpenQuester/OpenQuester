import { gameWidth } from "../screen/gameScreenStyles";

export const actionStack = "flex w-full flex-col gap-2";
export const centeredActions = "flex w-full flex-wrap justify-center gap-2";

const bid = "min-h-10 rounded-full border px-3.5 text-sm";

export const actionDockStyles = {
  root: "sticky bottom-0 z-30 border-t border-line-strong bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur",
  content: `mx-auto flex ${gameWidth} flex-col gap-3 px-3 py-3 sm:px-6 md:flex-row md:flex-wrap md:items-center md:gap-x-6 md:gap-y-2 md:py-4 lg:flex-nowrap`,
  action:
    "flex min-w-0 flex-col items-stretch gap-2 md:flex-[1_1_420px] md:items-center lg:flex-[0_1_480px]",
  desktopNextStep:
    "m-0 hidden min-w-0 flex-col gap-0.5 text-sm text-muted lg:flex lg:flex-[1_1_260px]",
  compactNextStep: "m-0 text-[13px] leading-snug text-muted md:basis-full lg:hidden",
  bid: `${bid} font-mono`,
  allInBid: `${bid} border-accent-line font-semibold text-accent-strong`,
  notice:
    "flex min-h-14 w-full items-center justify-center rounded-md border border-line-strong bg-surface-2 px-4 py-2 text-center text-[15px] text-soft",
  answerActions: "flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center",
  backHome:
    "flex min-h-14 w-full items-center justify-center rounded-md border-2 border-accent-strong bg-accent text-lg font-semibold text-on-accent no-underline hover:text-on-accent",
  statusGroup: "flex min-w-0 items-center gap-3.5 md:flex-[1_1_240px]",
  phase: "text-[13px] font-semibold uppercase tracking-[0.06em] text-info-soft",
  status: "text-[17px] font-semibold leading-snug [overflow-wrap:anywhere] 3xl:text-xl",
} as const;
