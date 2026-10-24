const surface =
  "fixed z-50 flex flex-col border-line-strong bg-surface text-text outline-none oq-slide-up";
const closeButton =
  "inline-flex items-center justify-center rounded-sm border border-line-strong hover:bg-surface-2";

/** Keep the same focus surface and overlay for ordinary and full-screen forms. */
export const dialogStyles = {
  overlay: "fixed inset-0 z-40 bg-scrim/70 oq-pop",
  surface,
  standardSurface: `${surface} border shadow-2xl`,
  closeButton,
  standardCloseButton: `${closeButton} h-11 w-11 text-text`,
  formCloseButton: `${closeButton} size-11`,
} as const;
