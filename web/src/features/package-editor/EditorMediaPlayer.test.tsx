import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EditorMediaPlayer } from "./EditorMediaPlayer";

afterEach(() => {
  vi.restoreAllMocks();
});

it("allows retry after playback is rejected", async () => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const play = vi
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockRejectedValueOnce(new Error("blocked"))
    .mockResolvedValueOnce();
  render(<EditorMediaPlayer src="file.webm" type="video" onDuration={() => {}} />);
  const button = screen.getByRole("button", { name: "Play" });
  fireEvent.click(button);
  await screen.findByRole("alert");
  expect(button).toBeEnabled();
  fireEvent.click(button);
  await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
});

it("restores the last audible volume after zero or mute", () => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const view = render(<EditorMediaPlayer src="file.mp3" type="audio" onDuration={() => {}} />);
  const media = view.container.querySelector("audio")!;
  const slider = screen.getByRole("slider", { name: "Volume" });
  fireEvent.change(slider, { target: { value: "0.4" } });
  fireEvent.change(slider, { target: { value: "0" } });
  expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
  expect(media.volume).toBeCloseTo(0.4);
  fireEvent.click(screen.getByRole("button", { name: "Mute" }));
  expect(media.muted).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
  expect(media.muted).toBe(false);
  expect(media.volume).toBeCloseTo(0.4);
});

it("keeps the seek slider at the requested audio position before the next time update", () => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const view = render(<EditorMediaPlayer src="file.wav" type="audio" onDuration={() => {}} />);
  const media = view.container.querySelector("audio")!;
  Object.defineProperty(media, "duration", { value: 130 });
  fireEvent.durationChange(media);
  const seek = screen.getByRole("slider", { name: "Seek" });
  fireEvent.change(seek, { target: { value: "0.1" } });
  expect(media.currentTime).toBeCloseTo(0.1);
  expect(seek).toHaveValue("0.1");
});
