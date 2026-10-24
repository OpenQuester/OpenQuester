import type { Question, QuestionFile } from "./protocol";

/**
 * Safety net only. A player reports ready when the media is really there, so
 * the question timer never starts before everyone can see it; the server's own
 * media timeout (30 s) moves the game on if someone's download stalls.
 */
const PRELOAD_TIMEOUT_MS = 45_000;

/**
 * Loads the question's media so playback can start in sync once the server
 * says everyone is ready. Failures return null: only the server's readiness
 * timeout may move the game on when a player's media is unavailable.
 */
export interface MediaDuration {
  md5: string;
  durationMs: number;
}

/**
 * Also reads each audio/video length: the server uses the longest report to
 * time the question's content steps, so a clip plays to its end.
 */
export async function preloadQuestionMedia(
  question: Question | null | undefined,
  signal?: AbortSignal,
): Promise<MediaDuration[] | null> {
  if (signal?.aborted) return null;
  const files = (question?.questionFiles ?? []).filter((f) => f.file.link);
  if (files.length === 0) return [];
  const durations: MediaDuration[] = [];
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = window.setTimeout(abort, PRELOAD_TIMEOUT_MS);
  try {
    const loaded = await Promise.all(
      files.map((f) => preloadFile(f, durations, controller.signal)),
    );
    return loaded.every(Boolean) && !controller.signal.aborted ? durations : null;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
    controller.abort();
  }
}

function preloadFile(
  file: QuestionFile,
  durations: MediaDuration[],
  signal: AbortSignal,
): Promise<boolean> {
  const url = file.file.link!;
  return new Promise<boolean>((resolve) => {
    if (signal.aborted) return resolve(false);
    const el =
      file.file.type === "image"
        ? new Image()
        : document.createElement(file.file.type === "video" ? "video" : "audio");
    let settled = false;
    const abort = () => done(false);
    const done = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      el.onload = el.onerror = null;
      if (el instanceof HTMLMediaElement) {
        el.oncanplaythrough = null;
        if (loaded && Number.isFinite(el.duration) && el.duration > 0) {
          durations.push({ md5: file.file.md5, durationMs: Math.round(el.duration * 1000) });
        }
        el.removeAttribute("src");
        el.load();
      } else el.removeAttribute("src");
      resolve(loaded);
    };
    signal.addEventListener("abort", abort, { once: true });
    if (file.file.type === "image") {
      // Decoded, not just downloaded: the picture paints the moment it shows.
      const img = el as HTMLImageElement;
      img.onload = () =>
        void img.decode().then(
          () => done(true),
          () => done(false),
        );
      img.onerror = () => done(false);
      img.src = url;
      return;
    }
    const media = el as HTMLMediaElement;
    media.preload = "auto";
    media.muted = true;
    media.oncanplaythrough = () => done(true);
    media.onerror = () => done(false);
    media.src = url;
    media.load();
  });
}
