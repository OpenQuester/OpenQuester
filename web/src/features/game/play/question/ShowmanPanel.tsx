import { questionStyles } from "./questionStyles";
import { useTranslation } from "react-i18next";
import { PlayerMessage, PlayerName } from "../PlayerName";
import { findPlayer, pointPicture, requiresAnswerSubmission } from "@/game/selectors";
import { formatSigned } from "@/lib/format";
import { useSession } from "../../GameContext";
import { PointPicker } from "../PointPicker";
import type { GameSession } from "@/game/reducer";
import type { Question } from "@/game/protocol";
import type { TranslateAction } from "../dock/actionDockModel";
import { ShowmanInstruction } from "./ShowmanInstruction";

function submittedAnswerLabel(session: GameSession, t: TranslateAction): string {
  if (session.submittedAnswer) return `“${session.submittedAnswer}”`;
  if (session.hasAnswerSubmission) return t("showman.emptySubmission");
  const question = session.state.currentQuestion;
  if (!question) return t("dock.answering.questionLoading");
  if (requiresAnswerSubmission(question)) return t("dock.answering.autoWaitHelp");
  return t("showman.sayingOutLoud");
}

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
      <ShowmanInstruction comment={q?.questionComment} />
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted">{t("showman.answer")}</span>
        <span className={questionStyles.showmanAnswer} data-testid="showman-answer">
          {q ? q.answerText || t("showman.noAnswerText") : t("dock.answering.questionLoading")}
        </span>
        {q?.answerHint && (
          <span className="text-sm text-soft">{t("showman.hint", { hint: q.answerHint })}</span>
        )}
        {q && <StructuredAnswer question={q} />}
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
            <PlayerMessage i18nKey="showman.answering" name={answering.meta.username} />
          </span>
          <span className="text-lg [overflow-wrap:anywhere]">
            {submittedAnswerLabel(session, t)}
          </span>
        </div>
      )}
      {(s.answeredPlayers ?? []).length > 0 && (
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{t("showman.alreadyAnswered")}</span>
          {(s.answeredPlayers ?? []).map((a) => (
            <span key={a.player} className="[overflow-wrap:anywhere]">
              <PlayerName>{findPlayer(session, a.player)?.meta.username}</PlayerName> ·{" "}
              {formatSigned(a.result)}
              {a.answerText ? ` · “${a.answerText}”` : null}
            </span>
          ))}
        </div>
      )}
    </aside>
  );
}

function StructuredAnswer({ question: q }: { question: Question }) {
  const { t } = useTranslation();
  const picture = pointPicture(q);
  if (q.answerType !== "number" && q.answerType !== "point") return null;
  return (
    <>
      {q.answerType === "number" && q.answerNumber != null && (
        <span className="text-sm text-success" data-testid="showman-number">
          {t("showman.number", {
            number: q.answerNumber,
            deviation: q.answerDeviation ? ` ± ${q.answerDeviation}` : "",
          })}
        </span>
      )}
      {q.answerType === "point" && q.answerPoint && picture && (
        <PointPicker
          src={picture}
          target={q.answerPoint}
          radius={q.answerDeviation}
          className="max-w-full"
        />
      )}
      <span className="text-xs text-muted">{t("showman.autoChecked")}</span>
    </>
  );
}
