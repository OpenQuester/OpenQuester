import type { Question, QuestionFile } from "./protocol";

/**
 * Safety net only. A player reports ready when the media is really there, so
 * the question timer never starts before everyone can see it; the server's own
 * media timeout (30 s) moves the game on if someone's download stalls.
 */
const PRELOAD_TIMEOUT_MS = 45_000;

/**
 * Loads the question's media so playback can start in sync once the server
 * says everyone is ready. Resolves even on failure: a broken file must never
 * block the game, the server's media timeout is the backstop.
 */
export async function preloadQuestionMedia(question: Question | null | undefined): Promise<void> {
  const files = (question?.questionFiles ?? []).filter((f) => f.file.link);
  if (files.length === 0) return;
  await Promise.race([
    Promise.all(files.map(preloadFile)),
    new Promise<void>((resolve) => window.setTimeout(resolve, PRELOAD_TIMEOUT_MS)),
  ]);
}

function preloadFile(file: QuestionFile): Promise<void> {
  const url = file.file.link!;
  return new Promise<void>((resolve) => {
    if (file.file.type === "image") {
      // Decoded, not just downloaded: the picture paints the moment it shows.
      const img = new Image();
      img.onload = () =>
        void img
          .decode()
          .catch(() => undefined)
          .then(() => resolve());
      img.onerror = () => resolve();
      img.src = url;
      return;
    }
    const el = document.createElement(file.file.type === "video" ? "video" : "audio");
    el.preload = "auto";
    el.muted = true;
    const done = () => {
      el.oncanplaythrough = el.onerror = null;
      resolve();
    };
    el.oncanplaythrough = done;
    el.onerror = done;
    el.src = url;
    el.load();
  });
}
