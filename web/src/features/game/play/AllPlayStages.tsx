import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

import { allPlayStakes, boardQuestionMeta, findPlayer, myRole } from "@/game/selectors";
import { formatScore, formatSigned } from "@/lib/format";
import { Badge } from "@/ui/Badge";

import { useGame, useSession } from "../GameContext";

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
    <section className="mx-auto flex w-full max-w-[880px] flex-col gap-4 oq-pop">
      <AllPlayHeader />
      <p className="m-0 font-display text-[clamp(24px,3.4vw,36px)] font-semibold leading-tight">
        {t("allPlay.stakePrompt")}
      </p>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label={t("allPlay.players")}>
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
  const { connection, myId } = useGame();
  const s = session.state;
  const data = s.allPlay;
  const isShowman = myRole(session, myId) === "showman";
  const q = s.currentQuestion;
  if (!data) return null;
  return (
    <section className="mx-auto flex w-full max-w-[1000px] flex-wrap items-start gap-6 oq-pop">
      <div className="flex min-w-[260px] flex-[1_1_320px] flex-col gap-3">
        <AllPlayHeader />
        <p className="m-0 font-display text-[clamp(22px,3vw,32px)] font-semibold leading-tight [overflow-wrap:anywhere]">
          {q?.text}
        </p>
        {isShowman && q?.answerText && (
          <div className="flex flex-col gap-1 rounded-md border border-success-line bg-success-surface p-4">
            <span className="text-sm text-muted">{t("reveal.answer")}</span>
            <span className="text-xl font-semibold text-success">{q.answerText}</span>
          </div>
        )}
      </div>
      <ul
        className="m-0 flex flex-[1_1_360px] list-none flex-col gap-2 p-0"
        aria-label={t("final.answers")}
      >
        {data.entries.map((e) => {
          const p = findPlayer(session, e.playerId);
          const { win, lose } = allPlayStakes(session, e);
          const pending = e.isCorrect == null;
          return (
            <li
              key={e.playerId}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-md border px-4 py-3",
                pending ? "border-accent-line bg-accent-surface" : "border-line",
              )}
              data-testid="all-play-answer"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-muted">
                  {p?.meta.username}
                  {data.mode === "stake" && (
                    <>
                      {" "}
                      · {t("final.bid")} <b className="font-mono text-text">{formatScore(win)}</b>
                    </>
                  )}
                </span>
                <span className="text-lg [overflow-wrap:anywhere]">
                  {e.answer ? `“${e.answer}”` : t("final.noAnswer")}
                </span>
              </div>
              {pending ? (
                isShowman ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="min-h-11 rounded-[12px] border border-success-line bg-success-surface px-4 font-semibold text-success"
                      onClick={() =>
                        connection.emit("all-play-review", {
                          playerId: e.playerId,
                          isCorrect: true,
                        })
                      }
                      data-testid="all-play-correct"
                    >
                      {t("judge.correct")} {formatSigned(win)}
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-[12px] border border-danger/40 bg-danger-surface px-4 font-semibold text-danger"
                      onClick={() =>
                        connection.emit("all-play-review", {
                          playerId: e.playerId,
                          isCorrect: false,
                        })
                      }
                      data-testid="all-play-wrong"
                    >
                      {t("judge.wrong")} {lose === 0 ? "±0" : formatSigned(lose)}
                    </button>
                  </div>
                ) : (
                  <span className="text-sm font-semibold text-accent-strong">
                    {t("final.judging")}
                  </span>
                )
              ) : (
                <span
                  className={cn(
                    "text-sm font-semibold",
                    e.isCorrect ? "text-success" : "text-danger",
                  )}
                >
                  {e.isCorrect ? t("judge.correct") : t("judge.wrong")} ·{" "}
                  {formatSigned(e.scoreChange ?? 0)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
