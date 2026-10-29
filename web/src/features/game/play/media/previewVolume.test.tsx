import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSettings } from "@/features/settings/settingsStore";
import { createGameStore } from "@/game/store";
import { GameContext } from "../../GameContext";
import { QuestionMediaPlayback } from "./QuestionMediaPlayback";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("changes preview volume without changing or persisting live settings", () => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const write = vi.spyOn(Storage.prototype, "setItem");
  const before = useSettings.getState().volume;
  const store = createGameStore();
  store.setState({ previewVolume: before });
  render(
    <GameContext.Provider value={{ myId: 2, store, connection: { connected: true, emit() {} } }}>
      <QuestionMediaPlayback
        src="preview.wav"
        type="audio"
        playing={false}
        loaded
        onLoaded={() => {}}
        onFailed={() => {}}
        loading={null}
      />
    </GameContext.Provider>,
  );
  fireEvent.change(screen.getByRole("slider"), { target: { value: "13" } });
  expect(store.getState().previewVolume).toBe(0.13);
  expect(useSettings.getState().volume).toBe(before);
  expect(write).not.toHaveBeenCalled();
});
