const animatedStage = "mx-auto flex w-full oq-pop";
const playerList = "m-0 flex list-none flex-wrap p-0";
const reviewButton = "min-h-11 rounded-[12px] border px-4 font-semibold";

export const stageStyles = {
  promptLayout: "mx-auto flex w-full max-w-[880px] flex-col gap-4 oq-pop",
  promptText: "m-0 font-display text-[clamp(24px,3.4vw,36px)] font-semibold leading-tight",
  reviewLayout: "mx-auto flex w-full max-w-[1000px] flex-wrap items-start gap-6 oq-pop",
  questionColumn: "flex min-w-[260px] flex-[1_1_320px] flex-col gap-3",
  reviewQuestion:
    "m-0 font-display text-[clamp(22px,3vw,32px)] font-semibold leading-tight [overflow-wrap:anywhere]",
  answerList: "m-0 flex flex-[1_1_360px] list-none flex-col gap-2 p-0",
  answerRow: "flex flex-wrap items-center gap-3 rounded-md border px-4 py-3",
  secretLayout: "mx-auto flex w-full max-w-[860px] flex-col gap-5 oq-pop",
  secretHeading: "m-0 font-display text-[clamp(24px,3.4vw,36px)] font-extrabold leading-tight",
  submittedPlayers: `${playerList} gap-2`,
  finalThemes:
    "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-3 p-0",
  finalTheme:
    "flex min-h-16 w-full flex-col items-start gap-1 rounded-md border px-4 py-3 text-left",
  finalQuestion: `${animatedStage} max-w-[920px] flex-col gap-4`,
  finalQuestionText:
    "m-0 font-display text-[clamp(24px,3.4vw,38px)] font-semibold leading-tight [overflow-wrap:anywhere]",
  secretRecipient:
    "flex min-h-16 items-center gap-3 rounded-md border px-4 py-3 text-left text-text",
  secretPrice: `${animatedStage} max-w-[920px] flex-wrap items-start gap-6`,
  selectedRecipient: "flex items-center gap-3 rounded-md border px-4 py-3",
  stakeBids: `${playerList} gap-3`,
  stakeBid:
    "rounded-md border border-line-strong bg-surface px-5 py-3 font-mono text-2xl font-bold",
  correctReview: `${reviewButton} border-success-line bg-success-surface text-success`,
  wrongReview: `${reviewButton} border-danger/40 bg-danger-surface text-danger`,
  correctAnswer: "flex flex-col gap-1 rounded-md border border-success-line bg-success-surface p-4",
  podium: `${animatedStage} max-w-[900px] flex-col items-center gap-8`,
  podiumPlaces: "m-0 flex w-full list-none items-end justify-center gap-3 p-0 sm:gap-5",
  podiumPlayer: "flex w-[30%] max-w-[200px] flex-col items-center gap-2",
  podiumStep:
    "flex w-full items-start justify-center rounded-t-md pt-3 font-display text-3xl font-extrabold",
  remainingPlaces: "m-0 flex w-full max-w-[520px] flex-col gap-2 p-0",
  remainingPlayer: "flex items-center gap-3 rounded-md bg-surface px-4 py-2.5",
  finalTitle: "m-0 font-display text-[clamp(26px,3.6vw,36px)] font-extrabold",
  podiumTitle: "m-0 text-center font-display text-[clamp(32px,6vw,52px)] font-extrabold",
  secretTitle: "m-0 font-display text-[clamp(26px,3.6vw,40px)] font-extrabold leading-tight",
  secretRecipientColumn: "flex flex-[1_1_300px] flex-col gap-2",
};
