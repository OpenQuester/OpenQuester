/** Same fixed frame for images, video and failed media. */

export const mediaFrame =
  "relative mx-auto flex aspect-video max-h-[min(55dvh,560px)] 3xl:max-h-[min(58dvh,860px)] w-full items-center justify-center overflow-hidden rounded-lg border border-line";

const playbackButton = "inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-semibold";

export const playbackStyles = {
  failure: "flex-col gap-2 border-dashed border-danger/50 bg-danger-surface p-6 text-center",
  loading: "absolute inset-0 flex items-center justify-center bg-surface-2",
  image: "absolute inset-0 h-full w-full object-contain transition-opacity duration-200",
  audioPlayer:
    "relative flex min-h-24 items-center gap-4 overflow-hidden rounded-lg border border-line bg-surface-2 p-4",
  audioIcon:
    "inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-surface text-accent",
  replay: `${playbackButton} border border-line-strong text-text hover:bg-surface-2`,
  enableSound: `${playbackButton} bg-accent text-on-accent`,
} as const;
