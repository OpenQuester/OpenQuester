const heroPanel = "flex min-w-0 flex-col gap-5 rounded-lg border p-6 sm:p-8";

export const homeStyles = {
  joinPanel: `${heroPanel} border-line bg-surface`,
  hostPanel: `${heroPanel} justify-between border-line-strong bg-surface-2`,
  heroTitle:
    "m-0 font-display text-[clamp(32px,5vw,44px)] font-extrabold leading-[1.05] tracking-tight",
  hostLink:
    "flex min-h-[52px] items-center justify-center rounded-md bg-primary text-[17px] font-semibold text-on-primary no-underline hover:text-on-primary",
  game: "flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface p-5",
  gameDetails: "flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted",
  joinLink:
    "mt-auto flex min-h-11 items-center justify-center rounded-[12px] border border-line-strong font-semibold text-text no-underline hover:bg-surface-2 hover:text-text",
  notice: "rounded-md border border-line-strong bg-surface-2 px-5 py-4 text-soft",
  gameFilter: "min-h-10 rounded-full border px-4 text-[15px] font-medium",
  games: "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-4 p-0",
  rejoinNotice:
    "flex flex-wrap items-center gap-4 rounded-[18px] border border-accent-line bg-accent-surface px-5 py-4",
  gameTitle: "m-0 text-[19px] font-semibold [overflow-wrap:anywhere]",
  gameMeta: "m-0 text-sm text-muted [overflow-wrap:anywhere]",
  entryColumns: "grid items-stretch gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]",
  codeInput: "h-[52px] flex-[1_1_240px] font-mono text-[17px]",
  hostTitle: "m-0 font-display text-[clamp(26px,3vw,32px)] font-extrabold",
  gamesTitle: "m-0 font-display text-[28px] font-extrabold",
  rejoinSummary: "flex min-w-[220px] flex-1 flex-col",
} as const;
