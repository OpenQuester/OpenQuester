import { layoutStyles } from "@/ui/layoutStyles";
import type { FinalAnswer } from "@/game/protocol";
import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

import { finalBid, finalPlayers, findPlayer, myRole, remainingFinalThemes } from "@/game/selectors";
import { formatScore, formatSigned } from "@/lib/format";
import { Badge } from "@/ui/Badge";

import { useGame, useSession } from "../GameContext";
import { AnswerReviewActions, ReviewedCorrectAnswer } from "./stages/AnswerReview";
import { stageStyles } from "./stages/stageStyles";
import { QuestionMedia } from "./QuestionMedia";
import { ShowmanInstruction } from "./question/ShowmanInstruction";

/** Players take turns removing themes; the last one left is the final question. */
export function FinalThemesStage() {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const s = session.state;
  const eliminated = new Set(s.finalRoundData?.eliminatedThemes ?? []);
  const role = myRole(session, myId);
  const myTurn = s.currentTurnPlayerId === myId;
  const canRemove = (myTurn || role === "showman") && !s.isPaused;
  const remaining = remainingFinalThemes(session).length;

  return (
    <section className={stageStyles.promptLayout} aria-labelledby="final-themes-h">
      <h2 id="final-themes-h" className={stageStyles.finalTitle}>
        {t("final.themesTitle")}
      </h2>
      <p className="m-0 text-soft">{t("final.themesHelp")}</p>
      <ul className={stageStyles.finalThemes}>
        {(s.currentRound?.themes ?? []).map((theme) => {
          const out = eliminated.has(theme.id);
          const disabled = out || !canRemove || remaining <= 1;
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
                aria-label={
                  out
                    ? t("final.themeRemoved", { name: theme.name })
                    : canRemove
                      ? t("final.removeTheme", { name: theme.name })
                      : theme.name
                }
              >
                <span className="text-lg font-semibold [overflow-wrap:anywhere]">{theme.name}</span>
                <span
                  className={cn(
                    "text-sm no-underline",
                    out ? "text-muted" : canRemove ? "text-accent-strong" : "text-muted",
                  )}
                >
                  {out
                    ? t("final.removed")
                    : canRemove && remaining > 1
                      ? t("final.remove")
                      : remaining <= 1
                        ? t("final.finalTheme")
                        : ""}
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

function FinalStatuses({ mode }: { mode: "bids" | "answers" }) {
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
            <Badge tone={done ? "success" : "accent"}>
              {label} ·{" "}
              {mode === "bids"
                ? done
                  ? t("final.bidPlaced")
                  : t("final.bidding")
                : done
                  ? t("final.answered")
                  : t("final.typing")}
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
  const hasMedia = (q?.questionFiles?.length ?? 0) > 0;
  return (
    <section className={stageStyles.finalQuestion}>
      <ThemeLine />
      {myRole(session, myId) === "showman" && <ShowmanInstruction comment={q?.questionComment} />}
      {/* Final questions skip the regular stage, so their media is shown here */}
      {hasMedia && <QuestionMedia files={q!.questionFiles!} playing={!session.state.isPaused} />}
      {(q?.text || !hasMedia) && (
        <p className={stageStyles.finalQuestionText} data-testid="question-text">
          {q?.text || t("question.noContent")}
        </p>
      )}
      <FinalStatuses mode="answers" />
    </section>
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
          <FinalReviewAnswer key={a.id} answer={a} />
        ))}
      </ul>
    </section>
  );
}

function FinalReviewAnswer({ answer }: { answer: FinalAnswer }) {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const isShowman = myRole(session, myId) === "showman";

  const p = findPlayer(session, answer.playerId);
  const bid = finalBid(session, answer.playerId) ?? 0;
  const pending = answer.isCorrect == null && !answer.autoLoss;
  return (
    <li
      className={cn(
        stageStyles.answerRow,
        pending ? "border-accent-line bg-accent-surface" : "border-line",
      )}
      data-testid="final-answer"
    >
      <div className={layoutStyles.summaryColumn}>
        <span className="text-sm text-muted">
          {p?.meta.username} · {t("final.bid")}{" "}
          <b className="font-mono text-text">{formatScore(bid)}</b>
        </span>
        <span className="text-lg [overflow-wrap:anywhere]">
          {answer.answer ? `“${answer.answer}”` : t("final.noAnswer")}
        </span>
      </div>
      {pending ? (
        isShowman ? (
          <AnswerReviewActions
            correct={formatSigned(bid)}
            wrong={formatSigned(-bid)}
            onReview={(isCorrect) =>
              connection.emit("final-answer-review", { answerId: answer.id, isCorrect })
            }
          />
        ) : (
          <span className="text-sm font-semibold text-accent-strong">{t("final.judging")}</span>
        )
      ) : (
        <span
          className={cn("text-sm font-semibold", answer.isCorrect ? "text-success" : "text-danger")}
        >
          {answer.autoLoss
            ? t("final.autoLoss", { points: formatSigned(-bid) })
            : answer.isCorrect
              ? `${t("judge.correct")} · ${formatSigned(bid)}`
              : `${t("judge.wrong")} · ${formatSigned(-bid)}`}
        </span>
      )}
    </li>
  );
}
