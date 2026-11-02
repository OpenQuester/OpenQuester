import { useContext } from "react";
import { useSettings } from "@/features/settings/settingsStore";
import { GameContext, useGameState } from "../../GameContext";

/** Playtest volume stays local to its game store. */
export function useMediaVolume() {
  const game = useContext(GameContext);
  const liveVolume = useSettings((s) => s.volume);
  const liveUpdate = useSettings((s) => s.update);
  const previewVolume = useGameState((s) => s.previewVolume);
  const setPreviewVolume = useGameState((s) => s.setPreviewVolume);
  return {
    volume: game?.store ? previewVolume : liveVolume,
    setVolume: (volume: number) => {
      if (game?.store) setPreviewVolume(volume);
      else liveUpdate({ volume });
    },
  };
}
