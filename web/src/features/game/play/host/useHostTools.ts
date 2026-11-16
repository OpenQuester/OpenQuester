import { phaseOf } from "@/game/selectors";
import { useGameStore } from "@/game/store";
import { useGame, useSession } from "../../GameContext";
export function useHostTools() {
  const session = useSession();
  const { connection } = useGame();
  const phase = phaseOf(session);
  const paused = session.state.isPaused;
  const boardEdit = useGameStore((s) => s.boardEdit);
  const setBoardEdit = useGameStore((s) => s.setBoardEdit);
  const lastRuling =
    (session.state.answeredPlayers ?? []).length > 0 ||
    !!session.state.answerShowData?.answerResult;
  const { scriptView, answeredPlayers, answeringPlayer, answerShowData } = session.state;
  const lastAttempt = answeredPlayers?.at(-1);
  const openScriptAsk =
    phase === "showing" &&
    scriptView?.waitingFor === "answer" &&
    scriptView.answerMode === "button" &&
    answeringPlayer == null &&
    !!lastAttempt &&
    lastAttempt.answerType !== "correct";
  const canUndo = scriptView
    ? !paused && (openScriptAsk || (phase === "reveal" && !!answerShowData && lastRuling))
    : (phase === "showing" || phase === "reveal") && lastRuling;
  return { session, connection, phase, paused, boardEdit, setBoardEdit, canUndo };
}
export type HostToolsModel = ReturnType<typeof useHostTools>;
