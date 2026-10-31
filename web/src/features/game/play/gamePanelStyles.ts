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
  playerChips: "player-cards",
  moderation: "flex flex-col gap-4 border-t border-line px-3 py-3",
  playerRestrictions: "flex flex-col gap-2.5 border-t border-line pt-3",
  playerGroupTitle: "m-0 text-sm font-semibold uppercase tracking-wider text-muted",
} as const;
