import { layoutStyles } from "@/ui/layoutStyles";
import type { FinalAnswer, Question } from "@/game/protocol";
import { parsePointAnswer } from "@/game/pointAnswer";
import { pointImage } from "@/lib/pointImage";
import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

import {
  finalBid,
  finalPlayers,
  findPlayer,
  isEligible,
  myRole,
  pointPicture,
  remainingFinalThemes,
} from "@/game/selectors";
import { formatScore, formatSigned } from "@/lib/format";
import { Badge } from "@/ui/Badge";

import { useGame, useSession } from "../GameContext";
import { AnswerReviewActions, ReviewedCorrectAnswer } from "./stages/AnswerReview";
import { stageStyles } from "./stages/stageStyles";
import { QuestionMedia } from "./QuestionMedia";
import { ShowmanInstruction } from "./question/ShowmanInstruction";
import { PointAnswer } from "./question/PointAnswer";
import { PointPicker } from "./PointPicker";
import { ContentStage } from "./ContentStage";
import { useFinalContent } from "./useFinalContent";
import type { ContentClock } from "@/game/reducer";
import type { ReactNode } from "react";

/** Players take turns removing themes; the last one left is the final question. */
export function FinalThemesStage() {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId, protectedFinalThemeId } = useGame();
  const s = session.state;
  const eliminated = new Set(s.finalRoundData?.eliminatedThemes ?? []);
  const role = myRole(session, myId);
  const myTurn = s.currentTurnPlayerId === myId;
  const canRemove = (myTurn || role === "showman") && !s.isPaused;
  const remaining = remainingFinalThemes(session).length;
  function themeLabel(name: string, protectedTheme: boolean, out: boolean) {
    if (protectedTheme) return t("editor.playtest.targetTheme", { name });
    if (out) return t("final.themeRemoved", { name });
    if (canRemove) return t("final.removeTheme", { name });
    return name;
  }
  function themeStatus(protectedTheme: boolean, out: boolean) {
    if (protectedTheme && remaining > 1) return t("editor.playtest.keepTheme");
    if (out) return t("final.removed");
    if (canRemove && remaining > 1) return t("final.remove");
    if (remaining <= 1) return t("final.finalTheme");
    return "";
  }

  return (
    <section className={stageStyles.promptLayout} aria-labelledby="final-themes-h">
      <h2 id="final-themes-h" className={stageStyles.finalTitle}>
        {t("final.themesTitle")}
      </h2>
      <p className="m-0 text-soft">{t("final.themesHelp")}</p>
      <ul className={stageStyles.finalThemes}>
        {(s.currentRound?.themes ?? []).map((theme) => {
          const out = eliminated.has(theme.id);
          const protectedTheme = theme.id === protectedFinalThemeId;
          const disabled = out || protectedTheme || !canRemove || remaining <= 1;
          return (
            <li key={theme.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => connection.emit("theme-eliminate", { themeId: theme.id })}
                data-testid="final-theme"
                className={cn(
                  stageStyles.finalTheme,
                  out && "border-line bg-transparent text-ghost line-through",
                  !out &&
                    !disabled &&
                    "border-accent-line bg-surface-2 text-text hover:border-accent",
                  !out && disabled && "cursor-default border-line-strong bg-surface-2 text-text",
                )}
                aria-label={themeLabel(theme.name, protectedTheme, out)}
                title={protectedTheme ? themeLabel(theme.name, true, out) : undefined}
              >
                <span className="text-lg font-semibold [overflow-wrap:anywhere]">{theme.name}</span>
                <span
                  className={cn(
                    "text-sm no-underline",
                    out ? "text-muted" : canRemove ? "text-accent-strong" : "text-muted",
                  )}
                >
                  {themeStatus(protectedTheme, out)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ThemeLine() {
  const { t } = useTranslation();
  const session = useSession();
  const s = session.state;
  const theme = s.finalRoundData?.questionData?.themeName ?? remainingFinalThemes(session)[0]?.name;
  return (
    <span className="text-sm font-semibold text-muted">
      {t("final.theme", { name: theme ?? "" })}
    </span>
  );
}

function finalStatusKey(mode: "bids" | "answers", done: boolean, contentPlaying: boolean) {
  if (mode === "bids") return done ? "final.bidPlaced" : "final.bidding";
  if (done) return "final.answered";
  return contentPlaying ? "stake.waiting" : "final.typing";
}

function FinalStatuses({
  mode,
  contentPlaying = false,
}: {
  mode: "bids" | "answers";
  contentPlaying?: boolean;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  return (
    <ul className={stageStyles.submittedPlayers}>
      {finalPlayers(session).map((p) => {
        const done =
          mode === "bids"
            ? finalBid(session, p.meta.id) != null
            : session.finalSubmitted.includes(p.meta.id);
        const label = p.meta.id === myId ? t("common.youCap") : p.meta.username;
        return (
          <li key={p.meta.id}>
            <Badge tone={done ? "success" : contentPlaying ? "neutral" : "accent"}>
              {label} · {t(finalStatusKey(mode, done, contentPlaying))}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

export function FinalBidStage() {
  const { t } = useTranslation();
  return (
    <section className={stageStyles.promptLayout}>
      <ThemeLine />
      <p className={stageStyles.promptText}>{t("final.bidPrompt")}</p>
      <FinalStatuses mode="bids" />
    </section>
  );
}

export function FinalAnswerStage() {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const q = session.state.finalRoundData?.questionData?.question ?? session.state.currentQuestion;
  const { content, playing: contentPlaying } = useFinalContent(session);
  const picture = pointPicture(q);
  const picking =
    picture &&
    !contentPlaying &&
    myRole(session, myId) === "player" &&
    isEligible(session, myId) &&
    finalBid(session, myId) != null;
  return (
    <section className={stageStyles.finalQuestion}>
      <ThemeLine />
      {session.state.finalRoundData?.questionData?.mediaPreparationTimedOut && (
        <p role="alert" className="m-0 text-center text-sm text-accent-strong">
          {t("final.mediaTimedOut")}
        </p>
      )}
      {myRole(session, myId) === "showman" && <ShowmanInstruction comment={q?.questionComment} />}
      <FinalQuestionContent
        question={q}
        content={content}
        picture={picking ? picture : null}
        paused={session.state.isPaused}
        myId={myId}
      />
      <FinalStatuses mode="answers" contentPlaying={contentPlaying} />
    </section>
  );
}

/** The final shows a timeline when present, or all legacy media together. */
function FinalQuestionContent({
  question: q,
  content,
  picture,
  paused,
  myId,
}: {
  question: Question | null | undefined;
  content: ContentClock | null;
  picture: string | null;
  paused: boolean;
  myId: number;
}) {
  const { t } = useTranslation();
  const files = q?.questionFiles ?? [];
  const hasMedia = files.length > 0;
  const target = pointImage(files, q?.pointImageOrder);
  const showCaption =
    (!content || q?.textOrder == null) && (!!q?.text || (!hasMedia && !q?.textItems?.length));
  let media: ReactNode = null;
  if (content && picture) {
    media = <PointAnswer key={myId} src={picture} />;
  } else if (content) {
    media = (
      <ContentStage
        content={content}
        files={files}
        text={q?.text}
        textOrder={q?.textOrder}
        textItems={q?.textItems}
        paused={paused}
      />
    );
  } else if (hasMedia) {
    media = (
      <QuestionMedia
        files={files}
        playing={!paused}
        replacePointImage={
          picture && target
            ? { file: target, view: <PointAnswer key={myId} src={picture} /> }
            : undefined
        }
      />
    );
  }
  return (
    <>
      {media}
      {showCaption && (
        <p className={stageStyles.finalQuestionText} data-testid="question-text">
          {q?.text || t("question.noContent")}
        </p>
      )}
    </>
  );
}

export function FinalReviewStage() {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const s = session.state;
  const final = s.finalRoundData;
  const isShowman = myRole(session, myId) === "showman";
  const q = final?.questionData?.question ?? s.currentQuestion;
  const reveal = s.answerShowData?.answerText;
  return (
    <section className={stageStyles.reviewLayout}>
      <div className={stageStyles.questionColumn}>
        <ThemeLine />
        {isShowman && <ShowmanInstruction comment={q?.questionComment} />}
        <p className={stageStyles.reviewQuestion}>{q?.text}</p>
        {(reveal || (isShowman && q?.answerText)) && (
          <ReviewedCorrectAnswer answer={reveal ?? q?.answerText} />
        )}
      </div>
      <ul className={stageStyles.answerList} aria-label={t("final.answers")}>
        {(final?.answers ?? []).map((a) => (
          <FinalReviewAnswer key={a.id} answer={a} question={isShowman ? q : undefined} />
        ))}
      </ul>
    </section>
  );
}

function FinalReviewAnswer({
  answer,
  question,
}: {
  answer: FinalAnswer;
  question?: Question | null;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const isShowman = myRole(session, myId) === "showman";

  const p = findPlayer(session, answer.playerId);
  const bid = finalBid(session, answer.playerId) ?? 0;
  const pending = answer.isCorrect == null && !answer.autoLoss;
  const picture = pointPicture(question);
  const picked = answer.answer ? parsePointAnswer(answer.answer) : null;
  const pointReview =
    isShowman && question?.answerType === "point" && question.answerPoint && picture;
  return (
    <li
      className={cn(
        stageStyles.answerRow,
        pending ? "border-accent-line bg-accent-surface" : "border-line",
      )}
      data-testid="final-answer"
    >
      <div className={cn(layoutStyles.summaryColumn, pointReview && "basis-full")}>
        <span className="text-sm text-muted">
          {p?.meta.username} · {t("final.bid")}{" "}
          <b className="font-mono text-text">{formatScore(bid)}</b>
        </span>
        <span className="text-lg [overflow-wrap:anywhere]">
          {answer.answer ? `“${answer.answer}”` : t("final.noAnswer")}
        </span>
        {pointReview && (
          <PointPicker
            src={picture}
            target={question.answerPoint}
            radius={question.answerDeviation}
            picked={picked}
          />
        )}
      </div>
      <FinalReviewOutcome
        answer={answer}
        bid={bid}
        pending={pending}
        isShowman={isShowman}
        onReview={(isCorrect) =>
          connection.emit("final-answer-review", { answerId: answer.id, isCorrect })
        }
      />
    </li>
  );
}

function FinalReviewOutcome({
  answer,
  bid,
  pending,
  isShowman,
  onReview,
}: {
  answer: FinalAnswer;
  bid: number;
  pending: boolean;
  isShowman: boolean;
  onReview: (isCorrect: boolean) => void;
}) {
  const { t } = useTranslation();
  if (pending && isShowman) {
    return (
      <AnswerReviewActions
        correct={formatSigned(bid)}
        wrong={formatSigned(-bid)}
        onReview={onReview}
      />
    );
  }
  if (pending) {
    return <span className="text-sm font-semibold text-accent-strong">{t("final.judging")}</span>;
  }
  const outcome = answer.autoLoss
    ? t("final.autoLoss", { points: formatSigned(-bid) })
    : `${t(answer.isCorrect ? "judge.correct" : "judge.wrong")} · ${formatSigned(answer.isCorrect ? bid : -bid)}`;
  return (
    <span
      className={cn("text-sm font-semibold", answer.isCorrect ? "text-success" : "text-danger")}
    >
      {outcome}
    </span>
  );
}
