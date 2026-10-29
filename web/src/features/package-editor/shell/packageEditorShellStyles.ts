import { layoutStyles } from "@/ui/layoutStyles";
import { linkStyles } from "@/ui/linkStyles";

export const packageEditorShellStyles = {
  header: "flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2.5 sm:px-5",
  backLink:
    "inline-flex min-h-11 items-center gap-1.5 rounded-sm px-2 font-medium text-muted no-underline hover:text-text",
  root: "flex h-dvh flex-col bg-bg text-text",
  outline: "hidden w-[272px] shrink-0 overflow-y-auto border-r border-line px-3 py-5 lg:block",
  workspace: "flex flex-col gap-5 px-4 py-5 sm:px-6 lg:px-7",
  inspector:
    "flex h-full w-full min-w-0 flex-col gap-4 overflow-y-auto border-l border-line bg-surface/60 p-5",
  inspectorHandle:
    "absolute inset-y-0 -left-1.5 z-10 w-3 touch-none cursor-col-resize rounded-sm hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
  inspectorGrip:
    "pointer-events-none absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-line-strong",
  inspectorClose:
    "inline-flex size-9 items-center justify-center rounded-sm text-muted hover:bg-surface-2",
  status: "flex items-center gap-3 border-t border-line bg-surface px-4 py-2.5 text-sm sm:px-5",
  toastPosition: "pointer-events-none fixed inset-x-0 bottom-16 z-[60] flex justify-center px-4",
  toast:
    "pointer-events-auto flex items-center gap-3 rounded-md border border-line-strong bg-surface-2 py-2 pr-2 pl-4 shadow-xl oq-slide-up",
  saveFailure: `${layoutStyles.spacedActions} rounded-md border border-danger/40 bg-danger-surface px-4 py-3`,
  addRound:
    "inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-muted",
  emptyPackage:
    "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-line-strong px-5 py-14 text-center",
  iconButton:
    "inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] border disabled:cursor-not-allowed disabled:text-ghost",
  densityToggle: "flex rounded-[12px] border border-line-strong p-0.5 sm:ml-1",
  densityOption: "hidden size-10 items-center justify-center rounded-[10px] sm:inline-flex",
  packageSubtitle:
    "inline-flex self-start items-center gap-1.5 px-1.5 text-left text-xs text-faint",
  historyActions: "flex w-full flex-wrap items-center gap-1.5 sm:w-auto",
  publishActions: "flex flex-1 items-center justify-end gap-2 sm:ml-1.5",
  issueCount: "rounded-full bg-danger-strong px-1.5 text-xs font-bold text-on-primary",
  roundTabs: "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden",
  roundTab: "flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold",
  previewPlayLink: linkStyles.centeredPrimary,
  previewBackLink:
    "inline-flex min-h-11 items-center gap-1.5 rounded-sm px-2 font-medium text-muted hover:text-text",
  previewTitle: "m-0 truncate px-1.5 font-display text-xl font-extrabold",
  previewStatus: "flex items-center gap-1.5 px-1.5 text-xs text-faint",
  cardsDensityOption: "inline-flex size-10 items-center justify-center rounded-[10px]",
} as const;
