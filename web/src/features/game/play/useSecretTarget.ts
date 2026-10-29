import { useGame, useGameState, useSession } from "../GameContext";

export function useSecretTarget(): [number | null, (id: number | null) => void] {
  const session = useSession();
  const { myId } = useGame();
  const scope = `${session.gameId}:${myId}:${session.state.currentRound?.id}:${session.state.secretQuestionData?.questionId}`;
  const target = useGameState((s) => (s.secretTarget.scope === scope ? s.secretTarget.id : null));
  const setTarget = useGameState((s) => s.setSecretTarget);
  return [target, (id) => setTarget(scope, id)];
}
