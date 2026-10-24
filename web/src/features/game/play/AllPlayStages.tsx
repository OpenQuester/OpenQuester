import { layoutStyles } from "@/ui/layoutStyles";
import type { AllPlayEntry, AllPlayMode } from "@/game/protocol";
import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

import { allPlayStakes, boardQuestionMeta, findPlayer, myRole } from "@/game/selectors";
import { formatScore, formatSigned } from "@/lib/format";
import { Badge } from "@/ui/Badge";

import { useGame, useSession } from "../GameContext";
import { AnswerReviewActions, ReviewedCorrectAnswer } from "./stages/AnswerReview";
import { stageStyles } from "./stages/stageStyles";

/** Theme and price of the "everyone answers" question, with its rule. */
function AllPlayHeader() {
  const { t } = useTranslation();
  const session = useSession();
  const data = session.state.allPlay;
  const meta = boardQuestionMeta(session, data?.questionId);
  if (!data) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-muted">
        {data.mode === "stake" ? t("allPlay.kickerStake") : t("allPlay.kickerNoRisk")}
        {meta && ` · ${meta.theme.name} · ${formatScore(data.price)}`}
      </span>
      <p className="m-0 text-soft">
        {data.mode === "stake"
          ? t("allPlay.ruleStake", {
              max: data.maxStake != null ? formatScore(data.maxStake) : t("stake.noLimit"),
            })
          : t("allPlay.ruleNoRisk", {
              points: formatScore(Math.round(data.price * (data.priceMultiplier ?? 1))),
            })}
      </p>
    </div>
  );
}

/** Stake for everyone: every player stakes before the question is shown. */
export function AllPlayStakeStage() {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const entries = session.state.allPlay?.entries ?? [];
  return (
    <section className={stageStyles.promptLayout}>
      <AllPlayHeader />
      <p className={stageStyles.promptText}>{t("allPlay.stakePrompt")}</p>
      <ul className={stageStyles.submittedPlayers} aria-label={t("allPlay.players")}>
        {entries.map((e) => {
          const p = findPlayer(session, e.playerId);
          const done = e.stake != null;
          return (
            <li key={e.playerId}>
              <Badge tone={done ? "success" : "accent"}>
                {e.playerId === myId ? t("common.youCap") : p?.meta.username} ·{" "}
                {done ? t("final.bidPlaced") : t("final.bidding")}
              </Badge>
            </li>
          );
        })}
      </ul>
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
        <AllPlayHeader />
        <p className={stageStyles.reviewQuestion}>{q?.text}</p>
        {isShowman && q?.answerText && <ReviewedCorrectAnswer answer={q.answerText} />}
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
  const { win, lose } = allPlayStakes(session, entry);
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
          {p?.meta.username}
          {mode === "stake" && (
            <>
              {" "}
              · {t("final.bid")} <b className="font-mono text-text">{formatScore(win)}</b>
            </>
          )}
        </span>
        <span className="text-lg [overflow-wrap:anywhere]">
          {entry.answer ? `“${entry.answer}”` : t("final.noAnswer")}
        </span>
      </div>
      {pending ? (
        isShowman ? (
          <AnswerReviewActions
            correct={formatSigned(win)}
            wrong={lose === 0 ? "±0" : formatSigned(lose)}
            onReview={(isCorrect) =>
              connection.emit("all-play-review", { playerId: entry.playerId, isCorrect })
            }
            testIdPrefix="all-play"
          />
        ) : (
          <span className="text-sm font-semibold text-accent-strong">{t("final.judging")}</span>
        )
      ) : (
        <span
          className={cn("text-sm font-semibold", entry.isCorrect ? "text-success" : "text-danger")}
        >
          {entry.isCorrect ? t("judge.correct") : t("judge.wrong")} ·{" "}
          {formatSigned(entry.scoreChange ?? 0)}
        </span>
      )}
    </li>
  );
}
