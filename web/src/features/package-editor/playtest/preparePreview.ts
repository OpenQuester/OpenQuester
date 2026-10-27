import { preloadQuestionMedia } from "@/game/media";
import type { Question } from "@/game/protocol";

/** Read the current decoded image, without updating or saving the draft. */
function aspectOf(src: string, signal: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let done = false;
    const finish = (aspect?: number) => {
      if (done) return;
      done = true;
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      image.onload = image.onerror = null;
      image.removeAttribute("src");
      if (aspect && Number.isFinite(aspect) && aspect > 0) resolve(aspect);
      else reject(new Error("previewMedia"));
    };
    const abort = () => finish();
    const timeout = window.setTimeout(abort, 15_000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) return finish();
    image.onload = () => finish(image.naturalWidth / image.naturalHeight);
    image.onerror = abort;
    image.src = src;
  });
}

/** Use real local media lengths for the same timeline the live stage plays. */
export async function preparePreviewQuestion(
  question: Question,
  signal: AbortSignal,
): Promise<Question> {
  const [questionDurations, answerDurations] = await Promise.all([
    preloadQuestionMedia(question, signal),
    preloadQuestionMedia({ ...question, questionFiles: question.answerFiles }, signal),
  ]);
  if (!questionDurations || !answerDurations || signal.aborted) throw new Error("previewMedia");
  const withDurations = (files: Question["questionFiles"], durations: typeof questionDurations) =>
    files?.map((file) => ({
      ...file,
      displayTime:
        file.displayTime ??
        durations.find((item) => item.md5 === file.file.md5)?.durationMs ??
        null,
    })) ?? null;
  let answerPoint = question.answerPoint;
  if (question.answerType === "point" && answerPoint) {
    const first = [...(question.questionFiles ?? [])]
      .sort((a, b) => a.order - b.order)
      .find((item) => item.file.type === "image");
    if (!first?.file.link) throw new Error("previewMedia");
    answerPoint = { ...answerPoint, imageAspectRatio: await aspectOf(first.file.link, signal) };
  }
  return {
    ...question,
    answerPoint,
    questionFiles: withDurations(question.questionFiles, questionDurations),
    // The server's reveal plan uses its own defaults when displayTime is absent.
    answerFiles: question.answerFiles ?? null,
  };
}
