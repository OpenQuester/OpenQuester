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
): Promise<MediaDuration[] | null> {
  const files = (question?.questionFiles ?? []).filter((f) => f.file.link);
  if (files.length === 0) return [];
  const durations: MediaDuration[] = [];
  let timeout: number | undefined;
  const ready = await Promise.race([
    Promise.all(files.map((f) => preloadFile(f, durations))).then((loaded) =>
      loaded.every(Boolean),
    ),
    new Promise<boolean>((resolve) => {
      timeout = window.setTimeout(() => resolve(false), PRELOAD_TIMEOUT_MS);
    }),
  ]).finally(() => window.clearTimeout(timeout));
  return ready ? durations : null;
}

function preloadFile(file: QuestionFile, durations: MediaDuration[]): Promise<boolean> {
  const url = file.file.link!;
  return new Promise<boolean>((resolve) => {
    if (file.file.type === "image") {
      // Decoded, not just downloaded: the picture paints the moment it shows.
      const img = new Image();
      img.onload = () =>
        void img.decode().then(
          () => resolve(true),
          () => resolve(false),
        );
      img.onerror = () => resolve(false);
      img.src = url;
      return;
    }
    const el = document.createElement(file.file.type === "video" ? "video" : "audio");
    el.preload = "auto";
    el.muted = true;
    const done = (loaded: boolean) => {
      el.oncanplaythrough = el.onerror = null;
      if (loaded && Number.isFinite(el.duration) && el.duration > 0) {
        durations.push({ md5: file.file.md5, durationMs: Math.round(el.duration * 1000) });
      }
      resolve(loaded);
    };
    el.oncanplaythrough = () => done(true);
    el.onerror = () => done(false);
    el.src = url;
    el.load();
  });
}
