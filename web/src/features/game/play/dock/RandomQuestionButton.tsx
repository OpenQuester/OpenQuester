import { useTranslation } from "react-i18next";
import { canPick } from "@/game/selectors";
import { Button } from "@/ui/Button";
import { useGame, useGameState, useGameStoreApi, useSession } from "../../GameContext";

/** Randomize across remaining cells, then use the same command as the board. */
export function RandomQuestionButton() {
  const { t } = useTranslation();
  const { myId, connection } = useGame();
  const store = useGameStoreApi();
  const session = useSession();
  const pending = useGameState((s) => s.pending);
  const online = useGameState((s) => s.connection === "connected");
  const available = session.state.currentRound?.themes.some((theme) =>
    theme.questions.some((question) => canPick(session, myId, question).ok),
  );

  function pick() {
    const current = store.getState();
    const latest = current.session;
    if (!latest || current.pending || current.connection !== "connected" || !connection.connected)
      return;
    const candidates = latest.state.currentRound?.themes
      .flatMap((theme) => theme.questions)
      .filter((question) => canPick(latest, myId, question).ok);
    if (!candidates?.length) return;
    const question = candidates[Math.floor(Math.random() * candidates.length)]!;
    connection.emit("question-pick", { questionId: question.id });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={!available || !!pending || !online || !connection.connected}
      onClick={pick}
      data-testid="pick-random-question"
    >
      {t(available ? "dock.choosing.randomQuestion" : "dock.choosing.noQuestions")}
    </Button>
  );
}
