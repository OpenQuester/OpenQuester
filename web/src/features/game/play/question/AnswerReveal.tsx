import { questionStyles, questionContentLayout } from "./questionStyles";
import { useTranslation } from "react-i18next";
import { ReportQuestionButton } from "@/features/stats/QuestionReporting";
import { findPlayer, pointPicture } from "@/game/selectors";
import { parsePointAnswer } from "@/game/pointAnswer";
import { formatSigned } from "@/lib/format";
import { useGame, useSession } from "../../GameContext";
import { ContentStage } from "../ContentStage";
import { PointPicker } from "../PointPicker";
import { QuestionMedia } from "../QuestionMedia";
import { allPlayRevealText } from "../allPlayRevealText";
import type { GameSession } from "@/game/reducer";
import type { AnsweredPlayer } from "@/game/protocol";
import type { TranslateAction } from "../dock/actionDockModel";

/** The reveal is the first time all submitted points may be shown together. */
function pointMarkers(session: GameSession, result: AnsweredPlayer | null, t: TranslateAction) {
  const s = session.state;
  const answers = s.allPlay
    ? s.allPlay.entries.map((entry) => ({
        id: entry.playerId,
        answer: entry.answer,
        correct: entry.isCorrect,
      }))
    : (s.answeredPlayers?.length ? s.answeredPlayers : result ? [result] : []).map((entry) => ({
        id: entry.player,
        answer: entry.answerText,
        correct: entry.answerType === "skip" ? null : entry.answerType === "correct",
      }));
  return answers.flatMap(({ id, answer, correct }) => {
    const spot = answer ? parsePointAnswer(answer) : null;
    return spot
      ? [
          {
            ...spot,
            id,
            name: findPlayer(session, id)?.meta.username ?? `${t("roles.player")} ${id}`,
            correct: correct ?? null,
          },
        ]
      : [];
  });
}

export function AnswerReveal() {
  const { t } = useTranslation();
  const session = useSession();
  const { store } = useGame();
  const s = session.state;
  const data = s.answerShowData;
  const allPlaySummary = allPlayRevealText(session, t);
  const result =
    allPlaySummary == null
      ? (data?.answerResult ?? (s.answeredPlayers ?? []).at(-1) ?? null)
      : null;
  const winner =
    result && result.answerType === "correct" ? findPlayer(session, result.player) : undefined;
  const respondent = result ? findPlayer(session, result.player) : undefined;
  const answerText = data?.answerText ?? s.currentQuestion?.answerText ?? null;
  const pointImage = data?.answerPointImage ?? pointPicture(s.currentQuestion);
  const markers = pointMarkers(session, result, t);
  const hasVisiblePointAnswer = !!(
    data?.answerPoint &&
    pointImage &&
    result?.answerText &&
    parsePointAnswer(result.answerText) &&
    markers.some((marker) => marker.id === result.player)
  );
  const hasCredits = !!data?.authors?.length || !!data?.sources?.length;
  const credits = [
    data?.authors?.length ? t("reveal.authors", { names: data.authors.join(", ") }) : null,
    data?.sources?.length ? t("reveal.sources", { list: data.sources.join(", ") }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className={questionContentLayout} data-testid="answer-reveal">
      <span className="text-sm font-semibold uppercase tracking-wider text-muted">
        {t("reveal.answer")}
      </span>
      {answerText && <p className={questionStyles.revealedAnswer}>{answerText}</p>}
      {data?.correctChoiceImage && (
        <img
          src={data.correctChoiceImage}
          alt={t("reveal.answer")}
          className="max-h-80 max-w-full rounded-md object-contain"
        />
      )}
      {data?.answerPoint && pointImage && (
        <PointPicker
          src={pointImage}
          target={data.answerPoint}
          radius={data.answerDeviation}
          markers={markers}
          className="self-center"
        />
      )}
      {!!data?.rightAnswers?.length && (
        <p className="m-0 text-center text-soft">
          {t("reveal.alsoRight", { answers: data.rightAnswers.join(" · ") })}
        </p>
      )}
      {session.content?.kind === "answer" ? (
        <ContentStage
          content={session.content}
          files={data?.answerFiles ?? []}
          paused={s.isPaused}
        />
      ) : (
        data?.answerFiles &&
        data.answerFiles.length > 0 && (
          <QuestionMedia files={data.answerFiles} playing={!s.isPaused} />
        )
      )}
      <p className="m-0 text-center text-lg text-soft [overflow-wrap:anywhere] 3xl:text-2xl">
        {allPlaySummary ??
          (winner
            ? t("reveal.gotIt", {
                name: winner.meta.username,
                points: formatSigned(result!.result),
              })
            : t("reveal.nobody"))}
      </p>
      {result?.answerText != null && result.answerText !== "" && !hasVisiblePointAnswer && (
        <p
          className="m-0 text-center text-soft [overflow-wrap:anywhere]"
          data-testid="submitted-answer"
        >
          {t("reveal.submitted", {
            name: respondent?.meta.username ?? t("roles.player"),
            answer: result.answerText,
          })}
        </p>
      )}
      {hasCredits && (
        <p className="m-0 text-center text-sm text-muted" data-testid="answer-credits">
          {credits}
        </p>
      )}
      {!store && s.currentQuestion?.id != null && (
        <ReportQuestionButton questionId={s.currentQuestion.id} />
      )}
    </div>
  );
}
