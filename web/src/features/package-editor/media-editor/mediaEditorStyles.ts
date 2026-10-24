import { layoutStyles } from "@/ui/layoutStyles";

const editorColumn = "flex min-h-0 min-w-0 flex-1 flex-col";
const previewColumn = "flex min-w-0 shrink-0 flex-col gap-3";
const responsivePreview = "lg:min-h-0 lg:flex-1";
const settingsPanel = "flex shrink-0 flex-col border-t border-line";
const desktopSettingsPanel = "lg:w-72 lg:overflow-y-auto lg:border-t-0 lg:border-l";
const previewSurface = "rounded-md border border-line bg-surface-3";
const timelineOverlay = "pointer-events-none absolute inset-y-0";

/** Shared media workspace structure and its image/audio-video variants. */
export const mediaEditorStyles = {
  editor: editorColumn,
  audioVideoWorkspace: `${editorColumn} gap-4 p-4 lg:flex-row`,
  imageWorkspace: "flex min-w-0 shrink-0 flex-col lg:min-h-0 lg:flex-1 lg:flex-row",
  header: `${layoutStyles.spacedActions} border-b border-line px-4 py-3`,
  body: "flex min-h-0 flex-1 flex-col overflow-y-auto",
  footer: `${layoutStyles.actions} border-t border-line p-3`,
  failure: "flex w-full flex-wrap items-center gap-2 text-danger",
  toolbar: "flex shrink-0 flex-wrap items-center gap-2 border-b border-line p-3",
  title: "m-0 truncate font-display text-xl font-bold",
  imagePreviewColumn: `${previewColumn} bg-bg/40 p-3 ${responsivePreview}`,
  audioVideoPreviewColumn: `${previewColumn} ${responsivePreview}`,
  imageSettings: `${settingsPanel} gap-3 p-4 ${desktopSettingsPanel}`,
  audioVideoSettings: `${settingsPanel} gap-4 pt-4 ${desktopSettingsPanel} lg:pt-0 lg:pl-4`,
  imageViewport: `relative h-72 shrink-0 overflow-auto ${previewSurface} lg:h-auto ${responsivePreview}`,
  videoViewport: `relative grid h-56 shrink-0 place-items-center overflow-hidden ${previewSurface} lg:h-auto ${responsivePreview}`,
  video: "max-h-[38dvh] max-w-full lg:absolute lg:h-full lg:max-h-full lg:w-full lg:object-contain",
  muteButton:
    "absolute right-3 bottom-3 w-11 bg-bg/70 px-0 text-text backdrop-blur-sm hover:bg-bg/90",
  unsupportedImage: "flex min-h-0 flex-1 flex-col items-center gap-4 p-6",
  duration: "m-0 rounded-sm bg-surface-3 p-3 text-sm tabular-nums",
  timeline: `relative shrink-0 touch-none cursor-crosshair overflow-hidden ${previewSurface} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`,
  trimBefore: `${timelineOverlay} left-0 bg-scrim/70`,
  trimAfter: `${timelineOverlay} right-0 bg-scrim/70`,
  retainedInterval: `${timelineOverlay} border-2 border-accent/70`,
  fadeEnvelope: "pointer-events-none absolute inset-0 h-full w-full text-text",
  playhead: `${timelineOverlay} w-0.5 -translate-x-1/2 bg-text`,
  playheadHandle: "absolute top-0 left-1/2 h-3 w-2 -translate-x-1/2 rounded-b-sm bg-text",
  toolShortcut: "font-sans text-[10px] leading-3 opacity-70",
} as const;
