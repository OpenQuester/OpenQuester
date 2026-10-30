import { gameWidth } from "../screen/gameScreenStyles";

export const actionStack = "flex w-full flex-col gap-2";
export const compactActions = "flex min-w-0 w-full items-center gap-2 [&>button]:shrink-0";
export const centeredActions = "flex w-full flex-wrap justify-center gap-2";

const bid = "min-h-10 rounded-full border px-3.5 text-sm";

export const actionDockStyles = {
  root: "game-dock relative z-30 shrink-0 border-t border-line-strong bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur",
  content: `game-dock-content mx-auto flex ${gameWidth} flex-col gap-2 px-3 py-2 sm:px-6 md:flex-row md:items-center md:gap-x-5 lg:py-3`,
  action:
    "flex min-w-0 flex-col items-stretch gap-2 md:flex-[1_1_420px] md:items-center lg:flex-[0_1_480px]",
  desktopNextStep:
    "m-0 hidden min-w-0 flex-col gap-0.5 text-xs leading-snug text-muted [overflow-wrap:anywhere] lg:flex lg:flex-[1_1_260px]",
  compactNextStep: "game-dock-help lg:hidden",
  bid: `${bid} font-mono`,
  allInBid: `${bid} border-accent-line font-semibold text-accent-strong`,
  notice:
    "flex min-h-14 min-w-0 w-full flex-1 items-center justify-center rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-center text-[15px] text-soft",
  answerActions: "flex w-full items-center gap-2",
  backHome:
    "flex min-h-14 w-full items-center justify-center rounded-md border-2 border-accent-strong bg-accent text-lg font-semibold text-on-accent no-underline hover:text-on-accent",
  statusGroup: "game-dock-status flex min-w-0 items-center gap-3 md:flex-[1_1_240px]",
  phase: "text-[13px] font-semibold uppercase tracking-[0.06em] text-info-soft",
  status: "text-[17px] font-semibold leading-snug [overflow-wrap:anywhere] 3xl:text-xl",
} as const;
