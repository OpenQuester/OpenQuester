import { create } from "zustand";
import { useGame, useSession } from "../GameContext";

/** The secret-question recipient picked on the stage, confirmed in the dock. */
const useStore = create<{
  scope: string;
  target: number | null;
  set: (scope: string, id: number | null) => void;
}>((set) => ({
  scope: "",
  target: null,
  set: (scope, target) => set({ scope, target }),
}));

export function useSecretTarget(): [number | null, (id: number | null) => void] {
  const session = useSession();
  const { myId } = useGame();
  const scope = `${session.gameId}:${myId}:${session.state.currentRound?.id}:${session.state.secretQuestionData?.questionId}`;
  const target = useStore((s) => (s.scope === scope ? s.target : null));
  return [target, (id) => useStore.getState().set(scope, id)];
}
