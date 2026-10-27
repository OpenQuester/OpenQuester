import { questionStyles } from "./questionStyles";
import { useTranslation } from "react-i18next";
import { findPlayer, pointPicture } from "@/game/selectors";
import { formatSigned } from "@/lib/format";
import { useSession } from "../../GameContext";
import { PointPicker } from "../PointPicker";

/** Showman-only column: the answer, what the player said, and who buzzed. */
export function ShowmanPanel() {
  const { t } = useTranslation();
  const session = useSession();
  const s = session.state;
  const q = s.currentQuestion;
  const answering = findPlayer(session, s.answeringPlayer);
  return (
    <aside
      aria-label={t("showman.panel")}
      className={questionStyles.showmanAnswers}
      data-testid="showman-panel"
    >
      <span className={questionStyles.showmanLabel}>{t("showman.onlyYou")}</span>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted">{t("showman.answer")}</span>
        <span className={questionStyles.showmanAnswer} data-testid="showman-answer">
          {q?.answerText || t("showman.noAnswerText")}
        </span>
        {q?.answerHint && (
          <span className="text-sm text-soft">{t("showman.hint", { hint: q.answerHint })}</span>
        )}
        {q?.answerType === "number" && q.answerNumber != null && (
          <span className="text-sm text-success" data-testid="showman-number">
            {t("showman.number", {
              number: q.answerNumber,
              deviation: q.answerDeviation ? ` ± ${q.answerDeviation}` : "",
            })}
          </span>
        )}
        {q?.answerType === "point" && q.answerPoint && pointPicture(q) && (
          <PointPicker
            src={pointPicture(q)!}
            target={q.answerPoint}
            radius={q.answerDeviation}
            className="max-w-full"
          />
        )}
        {(q?.answerType === "number" || q?.answerType === "point") && (
          <span className="text-xs text-muted">{t("showman.autoChecked")}</span>
        )}
        {!!q?.rightAnswers?.length && (
          <span className="text-sm text-success" data-testid="showman-right-answers">
            {t("showman.alsoRight", { answers: q.rightAnswers.join(" · ") })}
          </span>
        )}
        {!!q?.wrongAnswers?.length && (
          <span className="text-sm text-danger" data-testid="showman-wrong-answers">
            {t("showman.notRight", { answers: q.wrongAnswers.join(" · ") })}
          </span>
        )}
      </div>
      {answering && (
        <div className={questionStyles.answerHint}>
          <span className="text-sm text-muted">
            {t("showman.answering", { name: answering.meta.username })}
          </span>
          <span className="text-lg [overflow-wrap:anywhere]">
            {session.submittedAnswer ? `“${session.submittedAnswer}”` : t("showman.sayingOutLoud")}
          </span>
        </div>
      )}
      {(s.answeredPlayers ?? []).length > 0 && (
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{t("showman.alreadyAnswered")}</span>
          {(s.answeredPlayers ?? []).map((a, i) => (
            <span key={i}>
              {findPlayer(session, a.player)?.meta.username} · {formatSigned(a.result)}
            </span>
          ))}
        </div>
      )}
    </aside>
  );
}
