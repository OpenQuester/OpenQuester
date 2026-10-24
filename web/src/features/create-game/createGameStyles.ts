const card = "flex flex-col rounded-lg border p-6";

export const createGameStyles = {
  section: `${card} gap-4 border-line bg-surface`,
  field: "flex flex-col gap-2",
  backLink: "mb-6 inline-flex min-h-11 items-center gap-2 text-muted no-underline",
  packagePreview: `${card} flex-[1_1_300px] gap-2.5 border-line-strong bg-surface-2`,
  settingsColumn: "flex min-w-0 flex-[999_1_520px] flex-col gap-5",
  previewLabel: "text-[13px] font-semibold uppercase tracking-wider text-muted",
  ruleCheckbox: "mt-0.5 h-5 w-5 shrink-0 accent-[var(--oq-accent)]",
  setupField: "flex flex-[1_1_200px] flex-col gap-2",
};
