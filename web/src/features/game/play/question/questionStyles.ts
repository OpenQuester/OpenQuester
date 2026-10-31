/** Shared question/reveal width and question typography, unchanged across stages. */

export const questionContentLayout =
  "question-content flex w-full max-w-[920px] flex-col items-center gap-5 oq-pop 3xl:max-w-[1280px] 4xl:max-w-[1600px]";
export const questionText =
  "question-text m-0 text-center font-display text-[clamp(22px,3.4vw,38px)] font-semibold 3xl:text-[clamp(40px,2.4vw,64px)] leading-tight [overflow-wrap:anywhere]";

const pointMarker = "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full";
const notice = "flex w-full flex-col items-center rounded-lg text-center";

export const questionStyles = {
  layout: "question-layout flex flex-1 flex-col gap-4 lg:flex-row lg:items-start",
  content: "question-main flex min-w-0 flex-1 flex-col items-center gap-4",
  heading: "flex w-full flex-wrap items-center justify-center gap-2 text-muted 3xl:text-xl",
  waiting: "m-0 rounded-sm bg-surface-2 px-3 py-2 text-sm text-muted",
  mediaStep: "question-step flex w-full flex-col items-center gap-4 oq-pop",
  picture: "relative inline-block w-fit max-w-full self-start rounded-lg",
  correctPoint: `${pointMarker} point-target aspect-square border-2 border-success bg-success/20`,
  chosenPoint: `${pointMarker} h-5 w-5 border-2 border-white shadow`,
  choiceLetter:
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-surface-3 text-sm",
  revealedAnswer:
    "m-0 text-center font-display text-[clamp(26px,4vw,44px)] font-extrabold 3xl:text-[clamp(44px,2.8vw,72px)] leading-tight text-success [overflow-wrap:anywhere]",
  unavailableMedia: `${notice} min-h-[240px] max-w-[720px] justify-center gap-3 border border-dashed border-line-strong p-8`,
  showmanAnswers:
    "flex w-full shrink-0 flex-col gap-2 rounded-lg border border-accent-line bg-accent-surface p-4 lg:w-[320px] lg:gap-3 lg:p-5 3xl:w-[420px] 3xl:text-lg",
  answerHint: "flex flex-col gap-1 rounded-md bg-bg/40 p-3",
  contentNote: "question-recap m-0 max-w-[60ch] text-center text-soft",
  answerComment: "m-0 max-w-[60ch] text-center text-muted",
  pointPicker:
    "cursor-crosshair focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
  showmanLabel: "text-xs font-semibold uppercase tracking-wider text-accent-strong",
  showmanAnswer: "text-lg font-semibold [overflow-wrap:anywhere] lg:text-xl",
} as const;
