import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { QuestionFile } from "@/game/protocol";
import { setUrlMappings } from "@/lib/urlMappings";

import { QuestionMediaItem } from "./QuestionMediaItem";

function file(type: "image" | "audio" | "video"): QuestionFile {
  return {
    order: 0,
    file: { md5: "abc", type, link: `https://s3.example.com/bucket/a/ab/abc` },
  } as unknown as QuestionFile;
}

afterEach(() => {
  setUrlMappings([]);
  vi.restoreAllMocks();
});

describe("QuestionMediaItem inside a Discord Activity", () => {
  it.each(["image", "audio", "video"] as const)(
    "loads the %s through the Activity's mapped path from the start",
    (type) => {
      vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
      setUrlMappings([{ prefix: "/media", target: "s3.example.com" }]);

      render(<QuestionMediaItem file={file(type)} playing={false} />);

      const el = screen.getByTestId(type === "image" ? "media-frame" : `media-${type}`);
      const media = type === "image" ? el.querySelector("img")! : el;
      expect(media.getAttribute("src")).toBe(`${window.location.origin}/media/bucket/a/ab/abc`);
    },
  );
});

describe("QuestionMediaItem playback", () => {
  it("starts again once it can play when a new load interrupted play()", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValueOnce(new DOMException("interrupted", "AbortError"))
      .mockResolvedValue(undefined);

    render(<QuestionMediaItem file={file("audio")} playing />);
    await act(async () => {});
    expect(play).toHaveBeenCalledTimes(1);

    act(() => {
      screen.getByTestId("media-audio").dispatchEvent(new Event("canplay"));
    });

    expect(play).toHaveBeenCalledTimes(2);
  });
});
