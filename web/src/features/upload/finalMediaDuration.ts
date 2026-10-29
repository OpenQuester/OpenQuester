import { detectMediaMime } from "./archive";
import type { MediaFile, ParsedPackage, UploadQuestion } from "./types";

const MAX_DURATION_MS = 120_000;

export class FinalMediaDurationError extends Error {
  constructor(
    public readonly reason: "unavailable" | "tooLong",
    public readonly fileName: string,
  ) {
    super(reason);
  }
}

/** Read metadata from the media actually used for the published package. */
export function readFinalMediaDuration(
  src: string,
  type: "audio" | "video",
  name: string,
  signal?: AbortSignal,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const media = document.createElement(type);
    let settled = false;
    const finish = (duration?: number) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      media.onloadedmetadata = media.onerror = null;
      media.removeAttribute("src");
      media.load();
      if (!duration || !Number.isFinite(duration) || duration <= 0)
        reject(new FinalMediaDurationError("unavailable", name));
      else if (duration > MAX_DURATION_MS) reject(new FinalMediaDurationError("tooLong", name));
      else resolve(Math.ceil(duration));
    };
    const abort = () => finish();
    const timeout = window.setTimeout(abort, 15_000);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) return abort();
    media.preload = "metadata";
    media.onloadedmetadata = () => finish(media.duration * 1000);
    media.onerror = abort;
    media.src = src;
    media.load();
  });
}

type TimelineFile = {
  order: number;
  file: { md5: string; type: "image" | "audio" | "video" };
  displayTime: number | null;
};

/** Preserve explicit lengths and legacy questions; measure only missing final lengths. */
export async function withFinalQuestionDurations<
  T extends { textItems?: unknown; questionFiles?: TimelineFile[] | null },
>(
  question: T,
  read: (file: TimelineFile) => Promise<number>,
  fileName: (file: TimelineFile) => string = (file) => file.file.md5,
): Promise<T> {
  if (question.textItems == null || !question.questionFiles) return question;
  const questionFiles = await Promise.all(
    question.questionFiles.map(async (file) => {
      if (file.file.type === "image") return file;
      const value = file.displayTime ?? (await read(file));
      if (!Number.isInteger(value) || value <= 0)
        throw new FinalMediaDurationError("unavailable", fileName(file));
      if (value > MAX_DURATION_MS) throw new FinalMediaDurationError("tooLong", fileName(file));
      return { ...file, displayTime: value };
    }),
  );
  return { ...question, questionFiles };
}

export async function withFinalMediaDurations(parsed: ParsedPackage): Promise<ParsedPackage> {
  const measurements = new Map<string, Promise<number>>();
  const read = (ref: TimelineFile) => {
    const key = ref.file.md5.toLowerCase();
    let result = measurements.get(key);
    if (!result) {
      const file = parsed.files.get(key);
      result = file
        ? measureFile(file)
        : Promise.reject(new FinalMediaDurationError("unavailable", key));
      measurements.set(key, result);
    }
    return result;
  };
  const rounds = await Promise.all(
    parsed.content.rounds.map(async (round) => {
      if (round.type !== "final") return round;
      const themes = await Promise.all(
        round.themes.map(async (theme) => ({
          ...theme,
          questions: await Promise.all(
            theme.questions.map((q: UploadQuestion) =>
              withFinalQuestionDurations(q, read, (ref) => {
                const file = parsed.files.get(ref.file.md5.toLowerCase());
                return file?.displayName ?? file?.name ?? ref.file.md5;
              }),
            ),
          ),
        })),
      );
      return { ...round, themes };
    }),
  );
  return { ...parsed, content: { ...parsed.content, rounds } };
}

async function measureFile(file: MediaFile): Promise<number> {
  const local = file.bytes.byteLength > 0;
  const src = local
    ? URL.createObjectURL(
        new Blob([file.bytes as BlobPart], {
          type: detectMediaMime(file.bytes, file.type, file.name),
        }),
      )
    : file.url;
  if (!src || file.type === "image")
    throw new FinalMediaDurationError("unavailable", file.displayName ?? file.name);
  try {
    return await readFinalMediaDuration(src, file.type, file.displayName ?? file.name);
  } finally {
    if (local) URL.revokeObjectURL(src);
  }
}
