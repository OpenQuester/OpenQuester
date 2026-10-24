import { layoutStyles } from "@/ui/layoutStyles";

const attachment = "flex items-center justify-center rounded-sm";

/** Shared attachment/preview and package text-tool presentation. */
export const packageEditorStyles = {
  missingAttachment: `${attachment} gap-2 border border-danger/40 bg-danger-surface p-2 text-center text-xs text-danger`,
  attachmentIcon: `${attachment} bg-surface-3 text-info-soft`,
  inlineText:
    "min-w-0 rounded-sm border border-transparent bg-transparent px-1.5 py-0.5 text-text outline-none placeholder:text-faint",
  previewChoices: "m-0 grid list-none grid-cols-2 gap-1.5 p-0",
  previewChoice:
    "flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-sm [overflow-wrap:anywhere]",
  previewAnswer: "flex flex-col gap-1 rounded-sm bg-success-surface px-3 py-2",
  previewDetails: "m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm",
  moveChoices: layoutStyles.compactOptionGroup,
  moveChoice: "flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border px-3",
  searchResults: "m-0 flex max-h-[50dvh] list-none flex-col gap-1 overflow-y-auto p-0",
  searchResult: "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left hover:bg-surface-2",
  questionPreviewText:
    "m-0 whitespace-pre-wrap font-semibold leading-snug [overflow-wrap:anywhere]",
  moveDestinations: "flex max-h-[40dvh] flex-col gap-1 overflow-y-auto",
} as const;
