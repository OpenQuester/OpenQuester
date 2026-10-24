export const packageBrowserStyles = {
  authorPackage:
    "flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-line bg-surface p-4 sm:p-5",
  authorPackageTitle:
    "self-start text-left text-lg font-semibold text-text [overflow-wrap:anywhere] hover:text-accent",
  previewLink:
    "flex min-h-12 items-center justify-center gap-2 rounded-md border border-line-strong font-semibold text-text no-underline hover:bg-surface-2 hover:text-text",
  filters: "flex flex-wrap items-end gap-x-5 gap-y-4 rounded-lg border border-line bg-surface p-4",
  packages:
    "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-3.5 p-0",
  package:
    "flex h-full w-full flex-col gap-2.5 rounded-[18px] border-2 bg-surface p-[18px] text-left text-text",
  unfinishedUpload: "flex flex-col gap-2 rounded-[12px] bg-warning-surface p-4",
  authorPackageSummary: "flex min-w-0 flex-[1_1_260px] flex-col gap-1",
} as const;
