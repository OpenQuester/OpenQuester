import { detectMediaMime } from "./archive";
import type { MediaFile, ParsedPackage, UploadQuestion, UploadRound, UploadTheme } from "./types";

export class PointImageDimensionsError extends Error {
  constructor() {
    super("pointImageDimensions");
    this.name = "PointImageDimensionsError";
  }
}

/** Decode the final upload image, including its browser-applied orientation. */
function imageAspect(file: MediaFile): Promise<number> {
  const local = file.bytes.byteLength > 0;
  const src = local
    ? URL.createObjectURL(
        new Blob([file.bytes as BlobPart], {
          type: detectMediaMime(file.bytes, file.type, file.name),
        }),
      )
    : file.url;
  if (!src) return Promise.reject(new PointImageDimensionsError());
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      finish();
      reject(new PointImageDimensionsError());
    }, 15_000);
    const finish = () => {
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      image.removeAttribute("src");
      if (local) URL.revokeObjectURL(src);
    };
    image.onload = () => {
      const aspect = image.naturalWidth / image.naturalHeight;
      finish();
      if (Number.isFinite(aspect) && aspect > 0) resolve(aspect);
      else reject(new PointImageDimensionsError());
    };
    image.onerror = () => {
      finish();
      reject(new PointImageDimensionsError());
    };
    image.src = src;
  });
}

/** Add authoritative geometry after optimization and before any HTTP request. */
export async function withPointImageDimensions(parsed: ParsedPackage): Promise<ParsedPackage> {
  const dimensions = new Map<string, Promise<number>>();
  const question = async (q: UploadQuestion): Promise<UploadQuestion> => {
    if (q.answerType !== "point" || !q.answerPoint) return q;
    const first = q.questionFiles
      ?.filter((f) => f.file.type === "image")
      .sort((a, b) => a.order - b.order)[0];
    const file = first && parsed.files.get(first.file.md5.toLowerCase());
    if (!file) throw new PointImageDimensionsError();
    let result = dimensions.get(file.md5);
    if (!result) {
      result = imageAspect(file);
      dimensions.set(file.md5, result);
    }
    const imageAspectRatio = await result;
    return { ...q, answerPoint: { ...q.answerPoint, imageAspectRatio } };
  };
  const rounds: UploadRound[] = [];
  for (const round of parsed.content.rounds) {
    const themes: UploadTheme[] = [];
    for (const theme of round.themes) {
      const questions: UploadQuestion[] = [];
      for (const item of theme.questions) questions.push(await question(item));
      themes.push({ ...theme, questions });
    }
    rounds.push({ ...round, themes });
  }
  return { ...parsed, content: { ...parsed.content, rounds } };
}
