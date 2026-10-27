import { dialogStyles } from "@/ui/dialogStyles";
import { layoutStyles } from "@/ui/layoutStyles";

const formSpacing = "px-4 py-3 sm:px-6";

export const questionFormStyles = {
  dialog: `${dialogStyles.surface} inset-0 md:inset-auto md:top-1/2 md:left-1/2 md:h-[min(860px,calc(100dvh-48px))] md:w-[min(1120px,calc(100vw-48px))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:border`,
  header: `flex items-center gap-3 border-b border-line ${formSpacing}`,
  footer: `${layoutStyles.spacedActions} border-t border-line ${formSpacing}`,
  body: "min-h-0 flex-1 overflow-y-auto",
  content: `${layoutStyles.contentColumn} gap-5 px-4 py-5 sm:px-6`,
  title: "m-0 font-display text-xl font-extrabold sm:text-2xl",
  actions: "flex flex-1 justify-end gap-3 sm:flex-none",
  previewLabel: "text-xs font-bold tracking-[0.08em] text-faint uppercase",
  attachment:
    "flex w-full min-w-0 flex-col gap-2 self-start rounded-sm border border-line bg-surface-2 p-2 sm:w-[220px]",
  attachmentTime: "min-h-8 w-14 rounded-[8px] border border-line-strong bg-bg px-2 text-text",
  attachmentRemove:
    "inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface-3 hover:text-danger",
  attachmentHint:
    "flex min-h-12 flex-1 items-center justify-center px-2 text-center text-sm text-faint",
  choiceRemove:
    "inline-flex size-12 shrink-0 items-center justify-center rounded-[12px] border border-line-strong text-muted hover:text-danger",
  choice: "flex min-w-0 flex-col gap-2 rounded-sm border border-line p-2",
  correctChoice:
    "flex min-h-12 shrink-0 cursor-pointer items-center gap-2 rounded-[12px] border px-3 text-sm font-semibold",
  questionType:
    "flex min-h-16 flex-col items-start gap-1 rounded-[12px] border-2 px-3 py-2 text-left",
  attachmentDropZone: "flex flex-wrap gap-3 rounded-md border-2 border-dashed p-2.5",
  answerMode: "m-0 flex flex-col gap-1 border-0 p-0",
  typeLabel: "text-xs font-bold tracking-[0.08em] text-accent-strong uppercase",
} as const;
