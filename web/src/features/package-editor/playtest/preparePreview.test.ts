import { afterEach, expect, it, vi } from "vitest";
import { question } from "@/game/fixtures";
import { preparePreviewQuestion } from "./preparePreview";

vi.mock("@/game/media", () => ({ preloadQuestionMedia: vi.fn().mockResolvedValue([]) }));
afterEach(() => vi.unstubAllGlobals());

it("measures legacy point geometry on the preview copy without changing the draft", async () => {
  class ImageStub {
    naturalWidth = 1200;
    naturalHeight = 600;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
    removeAttribute() {}
  }
  vi.stubGlobal("Image", ImageStub);
  const original = question(100, {
    answerType: "point",
    answerPoint: { x: 0.4, y: 0.6 },
    questionFiles: [
      { order: 0, displayTime: null, file: { md5: "image", type: "image", link: "blob:local" } },
    ],
  });
  const result = await preparePreviewQuestion(original, new AbortController().signal);
  expect(result.answerPoint).toEqual({ x: 0.4, y: 0.6, imageAspectRatio: 2 });
  expect(original.answerPoint).toEqual({ x: 0.4, y: 0.6 });
});
