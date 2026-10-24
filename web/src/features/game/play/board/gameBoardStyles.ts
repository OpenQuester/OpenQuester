const cell = "flex items-center rounded-md";
const height = "min-h-14 sm:min-h-16 lg:min-h-20 3xl:min-h-24 4xl:min-h-28";

export const gameBoardStyles = {
  theme: `${cell} bg-surface font-semibold leading-tight [overflow-wrap:anywhere]`,
  themeSize: `${height} px-3 py-2 text-[15px] sm:px-4 sm:text-base lg:text-lg 3xl:text-xl 4xl:text-2xl`,
  question: `${cell} w-full justify-center font-mono font-bold`,
  questionSize: `${height} text-lg sm:text-2xl lg:text-3xl 3xl:text-4xl 4xl:text-5xl`,
  playedQuestion: "border border-line bg-transparent text-ghost line-through opacity-60",
  availableQuestion:
    "border border-accent-line bg-surface-3 text-accent-strong hover:bg-accent-surface hover:border-accent",
  turnNotice:
    "flex flex-wrap items-center gap-3 rounded-md border border-accent-line bg-accent-surface px-4 py-2 text-sm",
  compactThemeName: "col-span-full px-1.5 pb-0.5 pt-1 text-[15px]",
} as const;
