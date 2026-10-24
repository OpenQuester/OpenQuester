import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useSettings } from "@/features/settings/settingsStore";
import { timer } from "@/game/fixtures";
import type { QuestionFile } from "@/game/protocol";
import type { ContentClock } from "@/game/reducer";
import { QuestionMediaItem } from "./QuestionMediaItem";
import { useContentPosition } from "./useContentPosition";

const file: QuestionFile = {
  order: 0,
  displayTime: null,
  file: { type: "video", md5: "clip", link: "https://media.test/clip.webm" },
};

beforeEach(() => {
  useSettings.setState({ volume: 0.8 });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("keeps the element and seeks to the latest server position only on resume", () => {
  const { rerender } = render(
    <QuestionMediaItem file={file} playing={false} positionMs={() => 1000} />,
  );
  const video = screen.getByTestId("media-video") as HTMLVideoElement;
  Object.defineProperties(video, { readyState: { value: 4 }, duration: { value: 60 } });
  video.currentTime = 1;
  rerender(<QuestionMediaItem file={file} playing={true} positionMs={() => 8000} />);
  expect(video.currentTime).toBe(8);
  rerender(<QuestionMediaItem file={file} playing={true} positionMs={() => 20000} />);
  expect(screen.getByTestId("media-video")).toBe(video);
  expect(video.currentTime).toBe(8);
  rerender(<QuestionMediaItem file={file} playing={false} positionMs={() => 20000} />);
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(2);
  rerender(<QuestionMediaItem file={file} playing={true} positionMs={() => 21000} />);
  expect(video.currentTime).toBe(21);
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
});

it.each(["pause", "unmount"])(
  "cancels delayed seek and autoplay fallback after %s",
  async (ending) => {
    let reject!: (error: unknown) => void;
    const play = vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const media = (playing: boolean) => (
      <QuestionMediaItem file={file} playing={playing} positionMs={() => 8000} />
    );
    const view = render(media(true));
    const video = screen.getByTestId("media-video") as HTMLVideoElement;
    expect(play).toHaveBeenCalledOnce();
    if (ending === "pause") view.rerender(media(false));
    else view.unmount();
    await act(async () => reject(new DOMException("Autoplay denied", "NotAllowedError")));
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(0);
    expect(video.muted).toBe(false);
    expect(play).toHaveBeenCalledOnce();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(screen.queryByTestId("enable-sound")).toBeNull();
  },
);

it("recovers blocked autoplay with muted playback, then restores sound and local replay", async () => {
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
    new DOMException("Tap first", "NotAllowedError"),
  );
  render(<QuestionMediaItem file={file} playing />);
  const video = screen.getByTestId("media-video") as HTMLVideoElement;
  const enableSound = await screen.findByTestId("enable-sound");
  expect(video.muted).toBe(true);
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  fireEvent.click(enableSound);
  expect(video.muted).toBe(false);
  fireEvent.change(screen.getByRole("slider", { name: "Media volume" }), {
    target: { value: "40" },
  });
  expect(video.volume).toBe(0.4);
  video.currentTime = 6;
  fireEvent.ended(video);
  fireEvent.click(screen.getByTestId("media-replay"));
  expect(video.currentTime).toBe(0);
  expect(screen.queryByTestId("media-replay")).toBeNull();
});

it("freezes the timeline, resumes at the next step and disposes its transition timer", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
  const content: ContentClock = {
    kind: "question",
    frozenAtMs: null,
    timer: timer(4000),
    plan: {
      totalMs: 4000,
      steps: [0, 2000].map((startMs, order) => ({
        startMs,
        durationMs: 2000,
        items: [{ kind: "file", placement: "screen", durationMs: 2000, order }],
      })),
    },
  };
  const { result, rerender, unmount } = renderHook(
    (c: ContentClock) => useContentPosition(c, false),
    { initialProps: content },
  );
  expect(result.current.position.index).toBe(0);
  expect(vi.getTimerCount()).toBe(1);
  rerender({ ...content, frozenAtMs: 1000 });
  act(() => vi.advanceTimersByTime(3000));
  expect(result.current.now()).toBe(1000);
  expect(result.current.position.index).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  rerender({ ...content, timer: timer(4000) });
  act(() => vi.advanceTimersByTime(2030));
  expect(result.current.position.index).toBe(1);
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
