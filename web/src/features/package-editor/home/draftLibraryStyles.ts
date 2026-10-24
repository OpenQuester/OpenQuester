export const draftLibraryStyles = {
  row: "flex items-center gap-2 rounded-md border border-line bg-surface p-2 pl-4",
  openDraft:
    "flex min-h-12 min-w-0 flex-1 flex-col justify-center text-text no-underline hover:text-text",
  deleteDraft:
    "inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-danger-surface hover:text-danger",
} as const;
