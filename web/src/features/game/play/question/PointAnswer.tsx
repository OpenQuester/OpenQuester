import { useState } from "react";
import { useTranslation } from "react-i18next";
import { myAllPlayEntry, phaseOf } from "@/game/selectors";
import { useGameStore } from "@/game/store";
import { useGame, useSession } from "../../GameContext";
import { PointPicker, pointAnswer, type Spot } from "../PointPicker";

/** The answering player clicks a spot; it is sent as their answer. */
export function PointAnswer({ src }: { src: string }) {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const pending = useGameStore((s) => s.pending);
  const online = useGameStore((s) => s.connection === "connected");
  const [picked, setPicked] = useState<Spot | null>(null);
  const event = phaseOf(session) === "all_play_answering" ? "all-play-answer" : "answer-submitted";
  const submitted =
    event === "all-play-answer"
      ? myAllPlayEntry(session, myId)?.submitted
      : session.submittedAnswer != null;
  const disabled = session.state.isPaused || !online || pending?.action === event || submitted;
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="m-0 font-semibold text-accent-strong">{t("point.prompt")}</p>
      <PointPicker
        src={src}
        picked={picked}
        onPick={
          disabled
            ? undefined
            : (spot) => {
                if (useGameStore.getState().pending?.action === event) return;
                setPicked(spot);
                connection.emit(event, { answerText: pointAnswer(spot) });
              }
        }
      />
    </div>
  );
}
