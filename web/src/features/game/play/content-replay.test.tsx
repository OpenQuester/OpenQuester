import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildContentPlan } from "@/game/contentPlan";
import { timer } from "@/game/fixtures";
import type { ContentClock } from "@/game/reducer";
import type { QuestionFile } from "@/game/protocol";
import { ContentStage } from "./ContentStage";
import { useContentPosition } from "./media/useContentPosition";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const files: QuestionFile[] = [
  { order: 1, displayTime: 4000, file: { md5: "clip", type: "video", link: "/clip.webm" } },
  {
    order: 2,
    displayTime: 3000,
    placement: "background",
    waitForFinish: false,
    file: { md5: "sound", type: "audio", link: "/sound.wav" },
  },
  { order: 3, displayTime: 2000, file: { md5: "image", type: "image", link: "/image.png" } },
];
const texts = [{ order: 4, text: "Last clue" }];
function clock(): ContentClock {
  return {
    kind: "question",
    timer: timer(60000),
    frozenAtMs: null,
    plan: buildContentPlan({ text: "First clue", textOrder: 0, textItems: texts, files })!,
  };
}

it.each([1, 2, 3, 4, 5, 10])(
  "shows a thumbnail strip only for a current queue of %i visuals",
  (count) => {
    const images: QuestionFile[] = Array.from({ length: count }, (_, order) => ({
      order,
      displayTime: 100,
      waitForFinish: order === count - 1,
      file: { md5: `image-${order}`, type: "image", link: `/image-${order}.png` },
    }));
    const content: ContentClock = {
      kind: "question",
      plan: buildContentPlan({ files: images })!,
      timer: timer(20000),
      frozenAtMs: null,
    };
    render(<ContentStage content={content} files={images} paused={false} />);
    expect(screen.queryByTestId("media-history")?.querySelectorAll("button").length ?? 0).toBe(
      count >= 5 ? count : 0,
    );
    act(() => vi.advanceTimersByTime(content.plan.totalMs + 30));
    expect(screen.queryByTestId("media-history")?.querySelectorAll("button").length ?? 0).toBe(
      count >= 5 ? count : 0,
    );
  },
);

it.each(["text", "audio"])(
  "replaces queue thumbnails and removes them on the following %s step",
  (last) => {
    const images: QuestionFile[] = Array.from({ length: 10 }, (_, order) => ({
      order,
      displayTime: 100,
      waitForFinish: order === 4 || order === 9,
      file: { md5: `image-${order}`, type: "image", link: `/image-${order}.png` },
    }));
    const files =
      last === "audio"
        ? [
            ...images,
            {
              order: 10,
              displayTime: 100,
              file: { md5: "audio", type: "audio" as const, link: "/audio.wav" },
            },
          ]
        : images;
    const textItems = last === "text" ? [{ order: 10, text: "Last clue" }] : [];
    const content: ContentClock = {
      kind: "question",
      plan: buildContentPlan({ files, textItems })!,
      timer: timer(20000),
      frozenAtMs: null,
    };
    render(<ContentStage content={content} files={files} textItems={textItems} paused={false} />);
    expect(screen.getByTestId("media-history").querySelector("img")).toHaveAttribute(
      "src",
      "/image-0.png",
    );
    act(() => vi.advanceTimersByTime(content.plan.steps[1]!.startMs + 1));
    expect(screen.getByTestId("media-history").querySelectorAll("button")).toHaveLength(5);
    expect(screen.getByTestId("media-history").querySelector("img")).toHaveAttribute(
      "src",
      "/image-5.png",
    );
    act(() =>
      vi.advanceTimersByTime(content.plan.steps[2]!.startMs - content.plan.steps[1]!.startMs),
    );
    expect(screen.queryByTestId("media-history")).toBeNull();
    act(() => vi.advanceTimersByTime(content.plan.totalMs + 30));
    expect(screen.queryByTestId("media-history")).toBeNull();
    fireEvent.click(screen.getByTestId("content-replay"));
    expect(screen.getByTestId("media-history").querySelector("img")).toHaveAttribute(
      "src",
      "/image-0.png",
    );
    expect(screen.getByRole("button", { name: "Image 1" })).toBeDisabled();
  },
);

it("replays text, video, image and background audio from the first step, only after the whole plan", () => {
  const content = clock();
  render(
    <ContentStage
      content={content}
      files={files}
      text="First clue"
      textOrder={0}
      textItems={texts}
      paused={false}
    />,
  );
  expect(screen.queryByTestId("content-replay")).toBeNull();
  act(() => vi.advanceTimersByTime(2030));
  const firstVideo = screen.getByTestId("media-video");
  fireEvent.ended(firstVideo);
  expect(screen.queryByTestId("content-replay")).toBeNull();
  expect(screen.queryByTestId("media-replay")).toBeNull();
  act(() => vi.advanceTimersByTime(4000));
  const firstSound = screen.getByTestId("media-audio");
  expect(screen.getByTestId("background-sound")).toBeVisible();
  act(() => vi.advanceTimersByTime(content.plan.totalMs - 6030 + 30));
  fireEvent.click(screen.getByTestId("content-replay"));
  expect(screen.getByTestId("question-text")).toHaveTextContent("First clue");
  expect(screen.getByTestId("content-step-label")).toHaveTextContent("Part 1 of 4");
  expect(screen.queryByTestId("content-replay")).toBeNull();
  act(() => vi.advanceTimersByTime(2030));
  expect(screen.getByTestId("media-video")).not.toBe(firstVideo);
  expect((screen.getByTestId("media-video") as HTMLVideoElement).currentTime).toBe(0);
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.getByTestId("media-audio")).not.toBe(firstSound);
  act(() => vi.advanceTimersByTime(content.plan.totalMs - 6030 + 30));
  expect(screen.getByTestId("content-replay")).toBeEnabled();
  expect(content.timer?.elapsedMs).toBe(0);
});

it.each(["text", "image"])(
  "offers replay for a %s-only sequence but not a single static item",
  (kind) => {
    const plan = {
      totalMs: 2000,
      steps: [0, 1000].map((startMs, order) => ({
        startMs,
        durationMs: 1000,
        items: [
          {
            kind: kind === "text" ? ("text" as const) : ("file" as const),
            order,
            durationMs: 1000,
            placement: "screen" as const,
          },
        ],
      })),
    };
    const content: ContentClock = { kind: "answer", plan, timer: timer(20000), frozenAtMs: null };
    const items = [0, 1].map((order) => ({ order, text: "Clue " + order }));
    const images: QuestionFile[] = [0, 1].map((order) => ({
      order,
      displayTime: 1000,
      file: { md5: "same-image", type: "image", link: "/image" },
    }));
    const view = render(
      <ContentStage
        content={content}
        files={kind === "image" ? images : []}
        textItems={items}
        paused={false}
      />,
    );
    act(() => vi.advanceTimersByTime(2030));
    fireEvent.click(screen.getByTestId("content-replay"));
    expect(screen.getByTestId("content-step")).toHaveAttribute("data-step", "1");
    act(() => vi.advanceTimersByTime(2030));
    view.rerender(
      <ContentStage
        content={{ ...content, plan: { ...plan, steps: [plan.steps[0]!] } }}
        files={kind === "image" ? [images[0]!] : []}
        paused={false}
      />,
    );
    expect(screen.queryByTestId("content-replay")).toBeNull();
  },
);

it("waits for nonblocking background sound even when the screen plan has already ended", () => {
  const sound: QuestionFile = {
    order: 0,
    displayTime: 4000,
    placement: "background",
    waitForFinish: false,
    file: { md5: "background", type: "audio", link: "/sound" },
  };
  const content: ContentClock = {
    kind: "question",
    timer: timer(20000),
    frozenAtMs: null,
    plan: buildContentPlan({ files: [sound] })!,
  };
  expect(content.plan.totalMs).toBe(0);
  render(<ContentStage content={content} files={[sound]} paused={false} />);
  const first = screen.getByTestId("media-audio");
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  expect(screen.queryByTestId("content-replay")).toBeNull();
  act(() => vi.advanceTimersByTime(4030));
  expect(screen.getByTestId("media-audio")).toBe(first);
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  expect(screen.queryByText("Finished")).toBeNull();
  expect(screen.getByText("Audio")).toBeVisible();
  fireEvent.click(screen.getByTestId("content-replay"));
  expect(screen.getByTestId("media-audio")).not.toBe(first);
  expect(screen.queryByTestId("content-replay")).toBeNull();
});

it("offers audio replay after completion, without showing routine status labels", () => {
  const sound: QuestionFile = {
    order: 0,
    displayTime: 1000,
    file: { md5: "audio", type: "audio", link: "/sound" },
  };
  const content: ContentClock = {
    kind: "question",
    timer: timer(20000),
    frozenAtMs: null,
    plan: buildContentPlan({ files: [sound] })!,
  };
  const view = render(<ContentStage content={content} files={[sound]} paused={false} />);
  expect(screen.getByText("Audio")).toBeVisible();
  const paused = { ...content, timer: { ...content.timer!, elapsedMs: 500 } };
  view.rerender(<ContentStage content={paused} files={[sound]} paused />);
  expect(screen.queryByText("Finished")).toBeNull();
  view.rerender(<ContentStage content={paused} files={[sound]} paused={false} />);
  act(() => vi.advanceTimersByTime(530));
  expect(screen.queryByText("Finished")).toBeNull();
  expect(screen.getByTestId("content-replay")).toBeEnabled();
  fireEvent.click(screen.getByTestId("content-replay"));
  expect(screen.getByText("Audio")).toBeVisible();
});

it("lays out text, audio and the shared volume in canvas order", () => {
  const sound = { ...files[1]!, placement: "screen" as const };
  const content: ContentClock = {
    kind: "question",
    timer: timer(20000),
    frozenAtMs: null,
    plan: buildContentPlan({ files: [sound] })!,
  };
  render(<ContentStage content={content} files={[sound]} paused={false} caption={<p>Clue</p>} />);
  const text = screen.getByTestId("question-text-scroll");
  const audio = screen.getByTestId("question-audio-region");
  const controls = screen.getByTestId("content-controls");
  expect(text.compareDocumentPosition(audio) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(audio.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(controls).toContainElement(screen.getByRole("slider"));
  expect(screen.getByTestId("media-audio")).toBeInTheDocument();
  expect(screen.getByText("Clue")).toBeVisible();
});

it("pauses replay, cancels on answer freeze, snapshot or disconnect, and cleans up its timer", () => {
  const content = clock();
  const { result, rerender, unmount } = renderHook(
    ({ content, paused, online }) => useContentPosition(content, paused, online),
    { initialProps: { content, paused: false, online: true } },
  );
  act(() => vi.advanceTimersByTime(content.plan.totalMs + 30));
  act(() => result.current.restart());
  act(() => vi.advanceTimersByTime(500));
  rerender({
    content: { ...content, timer: { ...content.timer!, elapsedMs: content.plan.totalMs + 530 } },
    paused: true,
    online: true,
  });
  const frozen = result.current.now();
  act(() => vi.advanceTimersByTime(4000));
  expect(result.current.now()).toBe(frozen);
  rerender({
    content: { ...content, timer: { ...timer(60000), elapsedMs: content.plan.totalMs + 530 } },
    paused: false,
    online: true,
  });
  act(() => vi.advanceTimersByTime(300));
  expect(result.current.now()).toBe(frozen + 300);
  rerender({
    content: { ...content, frozenAtMs: content.plan.totalMs },
    paused: false,
    online: true,
  });
  expect(result.current.attempt).toBe(0);
  rerender({ content, paused: false, online: true });
  act(() => result.current.restart());
  rerender({ content: { ...content, plan: { ...content.plan } }, paused: false, online: true });
  expect(result.current.attempt).toBe(0);
  act(() => result.current.restart());
  rerender({ content, paused: false, online: false });
  expect(result.current.attempt).toBe(0);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
