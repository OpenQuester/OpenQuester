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
