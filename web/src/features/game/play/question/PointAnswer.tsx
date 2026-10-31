import { useTranslation } from "react-i18next";
import { myAllPlayEntry, phaseOf } from "@/game/selectors";
import { useGame, useGameState, useGameStoreApi, useSession } from "../../GameContext";
import { pointAnswer } from "@/game/pointAnswer";
import { PointPicker } from "../PointPicker";
import { mediaFrame } from "../media/playbackStyles";
import { cn } from "@/lib/cn";

/** The answering player clicks a spot; it is sent as their answer. */
export function PointAnswer({ src }: { src: string }) {
  const { t } = useTranslation();
  const store = useGameStoreApi();
  const session = useSession();
  const { connection, myId } = useGame();
  const pending = useGameState((s) => s.pending);
  const online = useGameState((s) => s.connection === "connected");
  const questionId =
    session.state.currentQuestion?.id ?? session.state.finalRoundData?.questionData?.question.id;
  const scope = `${session.gameId}:${session.state.currentRound?.id}:${questionId}`;
  const picked = useGameState((s) =>
    s.pointSelections.scope === scope ? (s.pointSelections.byPlayer[myId] ?? null) : null,
  );
  const phase = phaseOf(session);
  const event =
    phase === "all_play_answering"
      ? "all-play-answer"
      : phase === "final_answering"
        ? "final-answer-submit"
        : "answer-submitted";
  const submitted =
    event === "all-play-answer"
      ? myAllPlayEntry(session, myId)?.submitted
      : event === "final-answer-submit"
        ? session.finalSubmitted.includes(myId)
        : session.submittedAnswer != null;
  const disabled = session.state.isPaused || !online || pending?.action === event || submitted;
  return (
    <div className="question-point-answer flex w-full flex-col items-center gap-3">
      <div className={cn(mediaFrame, "bg-surface [container-type:size]")} data-testid="media-frame">
        <PointPicker
          className="self-center"
          fitFrame
          imageClassName="rounded-none"
          src={src}
          picked={submitted || pending?.action === event ? picked : null}
          onPick={
            disabled
              ? undefined
              : (spot) => {
                  if (store.getState().pending?.action === event) return;
                  store.getState().setPointSelection(scope, myId, spot);
                  connection.emit(event, { answerText: pointAnswer(spot) });
                }
          }
        />
      </div>
      <p className="m-0 font-semibold text-accent-strong">
        {t(submitted ? "dock.final.answerLocked" : "point.prompt")}
      </p>
    </div>
  );
}
