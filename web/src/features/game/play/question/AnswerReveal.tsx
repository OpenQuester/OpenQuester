import { questionStyles, questionContentLayout } from "./questionStyles";
import { Trans, useTranslation } from "react-i18next";
import { PlayerMessage } from "../PlayerName";
import { ReportQuestionButton } from "@/features/stats/QuestionReporting";
import { findPlayer, pointPicture } from "@/game/selectors";
import { parsePointAnswer } from "@/game/pointAnswer";
import { useGame, useSession } from "../../GameContext";
import { ContentStage } from "../ContentStage";
import { PointResults } from "./PointResults";
import { QuestionMedia } from "../QuestionMedia";
import { QuestionBody } from "./QuestionBody";
import { allPlayRevealText } from "../allPlayRevealText";
import { RevealResult } from "./RevealResult";
import type { GameSession } from "@/game/reducer";
import type { AnsweredPlayer } from "@/game/protocol";
import type { TranslateAction } from "../dock/actionDockModel";

/** The reveal is the first time all submitted points may be shown together. */
function pointMarkers(session: GameSession, result: AnsweredPlayer | null, t: TranslateAction) {
  const s = session.state;
  const answers = s.finalRoundData
    ? s.finalRoundData.answers.map((entry) => ({
        id: entry.playerId,
        answer: entry.answer,
        correct: entry.isCorrect,
      }))
    : s.allPlay
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
  const s = session.state;
  const data = s.answerShowData;
  const allPlaySummary = allPlayRevealText(session, t);
  const result =
    allPlaySummary == null
      ? (data?.answerResult ?? (s.answeredPlayers ?? []).at(-1) ?? null)
      : null;
  const answerText = data?.answerText ?? s.currentQuestion?.answerText ?? null;
  const pointImage = data?.answerPointImage ?? pointPicture(s.currentQuestion);
  const markers = pointMarkers(session, result, t);
  const credits = revealCredits(data, t);
  if (data?.answerPoint && pointImage)
    return (
      <div className={questionContentLayout} data-testid="answer-reveal">
        <PointResults
          src={pointImage}
          target={data.answerPoint}
          radius={data.answerDeviation}
          markers={markers}
        />
      </div>
    );
  return (
    <div className={questionContentLayout} data-testid="answer-reveal">
      <QuestionBody
        label={t("reveal.answer")}
        textLength={(answerText?.length ?? 0) + credits.length + (result?.answerText?.length ?? 0)}
        footer={<RevealFooter credits={credits} />}
        media={data?.correctChoiceImage || data?.answerFiles?.length ? <RevealMedia /> : undefined}
        text={
          <RevealedText answerText={answerText} rightAnswers={data?.rightAnswers} result={result} />
        }
      />
    </div>
  );
}

function RevealFooter({ credits }: { credits: string }) {
  const { store } = useGame();
  const { state } = useSession();
  const questionId = store ? undefined : state.currentQuestion?.id;
  if (!credits && questionId == null) return null;
  return (
    <footer className="reveal-footer">
      {credits && (
        <p className="reveal-credits" data-testid="answer-credits">
          {credits}
        </p>
      )}
      {questionId != null && (
        <div className="ml-auto shrink-0">
          <ReportQuestionButton questionId={questionId} />
        </div>
      )}
    </footer>
  );
}

function RevealMedia() {
  const { t } = useTranslation();
  const { state, content } = useSession();
  const data = state.answerShowData;
  return (
    <>
      {data?.correctChoiceImage && (
        <img
          src={data.correctChoiceImage}
          alt={t("reveal.answer")}
          className="min-h-0 w-full flex-1 rounded-md object-contain"
        />
      )}
      {content?.kind === "answer" ? (
        <ContentStage content={content} files={data?.answerFiles ?? []} paused={state.isPaused} />
      ) : (
        !!data?.answerFiles?.length && (
          <QuestionMedia files={data.answerFiles} playing={!state.isPaused} />
        )
      )}
    </>
  );
}

function revealCredits(data: GameSession["state"]["answerShowData"], t: TranslateAction) {
  return [
    data?.authors?.length ? t("reveal.authors", { names: data.authors.join(", ") }) : null,
    data?.sources?.length ? t("reveal.sources", { list: data.sources.join(", ") }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function RevealedText({
  answerText,
  rightAnswers,
  result,
}: {
  answerText: string | null;
  rightAnswers?: string[] | null;
  result: AnsweredPlayer | null;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const respondent = result ? findPlayer(session, result.player) : undefined;
  return (
    <>
      {answerText && <p className={questionStyles.revealedAnswer}>{answerText}</p>}
      {!!rightAnswers?.length && (
        <p className="m-0 text-center text-soft">
          <Trans
            i18nKey="reveal.alsoRight"
            values={{ answers: rightAnswers.join(" · ") }}
            components={{ answers: <span className="text-success/75" /> }}
          />
        </p>
      )}
      <p
        className="m-0 text-center text-lg text-soft [overflow-wrap:anywhere] 3xl:text-2xl"
        data-testid="reveal-result"
      >
        <RevealResult result={result} />
      </p>
      {result?.answerText && (
        <p
          className="m-0 text-center text-soft [overflow-wrap:anywhere]"
          data-testid="submitted-answer"
        >
          <PlayerMessage
            i18nKey="reveal.submitted"
            name={respondent?.meta.username ?? t("roles.player")}
            values={{ answer: result.answerText }}
          />
        </p>
      )}
    </>
  );
}
