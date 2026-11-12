import { questionMediaFiles } from "./questionMediaFiles";
import { mapUrl } from "@/lib/urlMappings";

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
 * Reports audio/video lengths for authored question steps. Option media must
 * load before readiness but does not contribute to the question timeline.
 */
export async function preloadQuestionMedia(
  question: Question | null | undefined,
  signal?: AbortSignal,
): Promise<MediaDuration[] | null> {
  if (signal?.aborted) return null;
  const files = questionMediaFiles(question);
  if (files.some((f) => !f.file.link)) return null;
  if (files.length === 0) return [];
  // Repeated occurrences share downloaded bytes and one duration report.
  const distinct = new Map(
    files.map((entry) => [
      JSON.stringify([entry.file.md5, entry.file.type, entry.file.link]),
      entry,
    ]),
  );
  const authoredHashes = new Set(question?.questionFiles?.map(({ file }) => file.md5));
  const durations = new Map<string, number>();
  const recordDuration = (md5: string, durationMs: number) => {
    if (authoredHashes.has(md5)) {
      durations.set(md5, Math.max(durations.get(md5) ?? 0, durationMs));
    }
  };
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = window.setTimeout(abort, PRELOAD_TIMEOUT_MS);
  try {
    const loaded = await Promise.all(
      Array.from(distinct.values(), (file) => preloadFile(file, recordDuration, controller.signal)),
    );
    return loaded.every(Boolean) && !controller.signal.aborted
      ? Array.from(durations, ([md5, durationMs]) => ({ md5, durationMs }))
      : null;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
    controller.abort();
  }
}

function preloadFile(
  file: QuestionFile,
  recordDuration: (md5: string, durationMs: number) => void,
  signal: AbortSignal,
): Promise<boolean> {
  // Off-document elements: the Discord Activity's src patch doesn't reach them
  const url = mapUrl(file.file.link!);
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
          recordDuration(file.file.md5, Math.round(el.duration * 1000));
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
