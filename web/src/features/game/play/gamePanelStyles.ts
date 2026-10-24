const chatBubble = "flex flex-col gap-1 rounded-md px-3.5 py-2.5";
const hostSection = "flex flex-col gap-2 border-line p-4";

export const gamePanelStyles = {
  systemMessage: "m-0 self-center text-center text-sm text-soft [overflow-wrap:anywhere]",
  ownMessage: `${chatBubble} self-end rounded-br-sm bg-accent-surface`,
  otherMessage: `${chatBubble} self-start rounded-bl-sm bg-surface-2`,
  chatMessages: "flex flex-1 flex-col gap-3 overflow-y-auto p-5",
  hostActions: "flex flex-wrap gap-2 border-b border-line p-4",
  hostPlayers: `${hostSection} border-b`,
  hostRound: `${hostSection} border-t`,
  playerChips: "m-0 flex list-none gap-2 overflow-x-auto p-0 pb-0.5 [scrollbar-width:thin]",
  showmanChip:
    "flex shrink-0 items-center gap-2 rounded-full border border-accent-line/60 bg-surface py-1 pl-1 pr-3 text-sm",
  moderation: "flex flex-col gap-4 border-t border-line px-3 py-3",
  playerRestrictions: "flex flex-col gap-2.5 border-t border-line pt-3",
  playerGroupTitle: "m-0 text-sm font-semibold uppercase tracking-wider text-muted",
} as const;
