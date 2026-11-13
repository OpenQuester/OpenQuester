import { layoutStyles } from "@/ui/layoutStyles";
import type { AllPlayEntry, AllPlayMode } from "@/game/protocol";
import type { ScriptScoreEstimate } from "@/game/questionScript";
import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";
import { PlayerName } from "./PlayerName";

import {
  allPlayMaxStake,
  allPlayStakes,
  boardQuestionMeta,
  findPlayer,
  myAllPlayEntry,
  myRole,
} from "@/game/selectors";
import { formatScore, formatSigned } from "@/lib/format";

import { useGame, useSession } from "../GameContext";
import { AnswerReviewActions, ReviewedAnswer } from "./stages/AnswerReview";
import { stageStyles } from "./stages/stageStyles";

/** Theme and price stay above the stage's main content. */
function AllPlayHeader() {
  const { t } = useTranslation();
  const session = useSession();
  const data = session.state.allPlay;
  const meta = boardQuestionMeta(session, data?.questionId);
  if (!data) return null;
  return (
    <span className="text-sm font-semibold text-muted">
      {session.state.scriptView
        ? t("script.groupAnswer")
        : t(
            data.mode === "stake"
              ? "allPlay.kickerStake"
              : data.mode === "simple"
                ? "allPlay.kickerSimple"
                : "allPlay.kickerNoRisk",
          )}
      {meta &&
        ` · ${meta.theme.name}${session.state.scriptView ? "" : ` · ${formatScore(data.price)}`}`}
    </span>
  );
}

function AllPlayRule() {
  const { t } = useTranslation();
  const { allPlay: data, scriptView } = useSession().state;
  if (!data || (scriptView && scriptView.waitingFor !== "answerer")) return null;
  return (
    <p className="m-0 text-soft">
      {data.mode === "stake"
        ? t("allPlay.ruleStake")
        : data.mode === "simple"
          ? t(
              data.wrongAnswerPenalty === "none" ? "allPlay.ruleSimpleFree" : "allPlay.ruleSimple",
              { points: formatScore(data.price) },
            )
          : t("allPlay.ruleNoRisk", {
              points: formatScore(Math.round(data.price * (data.priceMultiplier ?? 1))),
            })}
    </p>
  );
}

/** Stake for everyone: every player stakes before the question is shown. */
export function AllPlayStakeStage() {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const entry = myAllPlayEntry(session, myId);
  return (
    <section className={stageStyles.promptLayout}>
      <AllPlayHeader />
      <div className={stageStyles.bidBody}>
        <div className={stageStyles.bidCard}>
          <p className={stageStyles.promptText}>{t("allPlay.stakePrompt")}</p>
          <AllPlayRule />
          {entry && entry.stake == null && (
            <p className="m-0 text-soft">
              {t("dock.final.bidRange", { max: formatScore(allPlayMaxStake(session, myId)) })}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Every answer is shown; the showman rules on each one. */
export function AllPlayReviewStage() {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const s = session.state;
  const data = s.allPlay;
  const isShowman = myRole(session, myId) === "showman";
  const q = s.currentQuestion;
  if (!data) return null;
  return (
    <section className={stageStyles.reviewLayout}>
      <div className={stageStyles.questionColumn}>
        <div className="flex flex-col gap-2">
          <AllPlayHeader />
          <AllPlayRule />
        </div>
        <p className={stageStyles.reviewQuestion}>{q?.text}</p>
        {isShowman && (
          <ReviewedAnswer
            kind="key"
            answer={q?.answerText}
            question={q}
            choiceOrder={q?.correctChoiceOrder}
            paused={s.isPaused}
          />
        )}
      </div>
      <ul className={stageStyles.answerList} aria-label={t("final.answers")}>
        {data.entries.map((e) => (
          <AllPlayReviewAnswer key={e.playerId} entry={e} mode={data.mode} />
        ))}
      </ul>
    </section>
  );
}

function AllPlayReviewAnswer({ entry, mode }: { entry: AllPlayEntry; mode: AllPlayMode }) {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const isShowman = myRole(session, myId) === "showman";

  const p = findPlayer(session, entry.playerId);
  const script = session.state.scriptView;
  const estimate = script
    ? script.reviewScoreEstimates?.[entry.playerId]
    : allPlayStakes(session, entry);
  const stake = script ? entry.stake : estimate?.win;
  const pending = entry.isCorrect == null;
  return (
    <li
      className={cn(
        stageStyles.answerRow,
        pending ? "border-accent-line bg-accent-surface" : "border-line",
      )}
      data-testid="all-play-answer"
    >
      <div className={layoutStyles.summaryColumn}>
        <span className="text-sm text-muted">
          <PlayerName>{p?.meta.username}</PlayerName>
          {mode === "stake" && stake != null && (
            <>
              {" "}
              · {t("final.bid")} <b className="font-mono text-text">{formatScore(stake)}</b>
            </>
          )}
        </span>
        <ReviewedAnswer
          answer={entry.answer ? `“${entry.answer}”` : t("final.noAnswer")}
          question={isShowman ? session.state.currentQuestion : null}
          choiceOrder={entry.choiceOrder}
          paused={session.state.isPaused}
        />
      </div>
      <AllPlayVerdict
        entry={entry}
        estimate={estimate}
        isShowman={isShowman}
        onReview={(isCorrect) =>
          connection.emit("all-play-review", { playerId: entry.playerId, isCorrect })
        }
      />
    </li>
  );
}

function AllPlayVerdict({
  entry,
  estimate,
  isShowman,
  onReview,
}: {
  entry: AllPlayEntry;
  estimate?: ScriptScoreEstimate;
  isShowman: boolean;
  onReview: (isCorrect: boolean) => void;
}) {
  const { t } = useTranslation();
  if (entry.isCorrect != null)
    return (
      <span
        className={cn("text-sm font-semibold", entry.isCorrect ? "text-success" : "text-danger")}
      >
        {entry.isCorrect ? t("judge.correct") : t("judge.wrong")}
        {entry.scoreChange != null ? ` · ${formatSigned(entry.scoreChange)}` : ""}
      </span>
    );
  if (!isShowman)
    return <span className="text-sm font-semibold text-accent-strong">{t("final.judging")}</span>;
  return (
    <AnswerReviewActions
      correct={estimate ? formatSigned(estimate.win) : ""}
      wrong={estimate ? (estimate.lose === 0 ? "±0" : formatSigned(estimate.lose)) : ""}
      onReview={onReview}
      testIdPrefix="all-play"
    />
  );
}
