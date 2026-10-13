import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

import { finalBid, finalPlayers, findPlayer, myRole, remainingFinalThemes } from "@/game/selectors";
import { formatScore, formatSigned } from "@/lib/format";
import { Badge } from "@/ui/Badge";

import { useGame, useSession } from "../GameContext";

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
    <section
      className="mx-auto flex w-full max-w-[880px] flex-col gap-4 oq-pop"
      aria-labelledby="final-themes-h"
    >
      <h2
        id="final-themes-h"
        className="m-0 font-display text-[clamp(26px,3.6vw,36px)] font-extrabold"
      >
        {t("final.themesTitle")}
      </h2>
      <p className="m-0 text-soft">{t("final.themesHelp")}</p>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-3 p-0">
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
                  "flex min-h-16 w-full flex-col items-start gap-1 rounded-md border px-4 py-3 text-left",
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
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
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
    <section className="mx-auto flex w-full max-w-[880px] flex-col gap-4 oq-pop">
      <ThemeLine />
      <p className="m-0 font-display text-[clamp(24px,3.4vw,36px)] font-semibold leading-tight">
        {t("final.bidPrompt")}
      </p>
      <FinalStatuses mode="bids" />
    </section>
  );
}

export function FinalAnswerStage() {
  const { t } = useTranslation();
  const session = useSession();
  const q = session.state.finalRoundData?.questionData?.question ?? session.state.currentQuestion;
  return (
    <section className="mx-auto flex w-full max-w-[920px] flex-col gap-4 oq-pop">
      <ThemeLine />
      <p
        className="m-0 font-display text-[clamp(24px,3.4vw,38px)] font-semibold leading-tight [overflow-wrap:anywhere]"
        data-testid="question-text"
      >
        {q?.text || t("question.noContent")}
      </p>
      <FinalStatuses mode="answers" />
    </section>
  );
}

export function FinalReviewStage() {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const s = session.state;
  const final = s.finalRoundData;
  const isShowman = myRole(session, myId) === "showman";
  const q = final?.questionData?.question ?? s.currentQuestion;
  const reveal = s.answerShowData?.answerText;
  return (
    <section className="mx-auto flex w-full max-w-[1000px] flex-wrap items-start gap-6 oq-pop">
      <div className="flex min-w-[260px] flex-[1_1_320px] flex-col gap-3">
        <ThemeLine />
        <p className="m-0 font-display text-[clamp(22px,3vw,32px)] font-semibold leading-tight [overflow-wrap:anywhere]">
          {q?.text}
        </p>
        {(reveal || (isShowman && q?.answerText)) && (
          <div className="flex flex-col gap-1 rounded-md border border-success-line bg-success-surface p-4">
            <span className="text-sm text-muted">{t("reveal.answer")}</span>
            <span className="text-xl font-semibold text-success">{reveal ?? q?.answerText}</span>
          </div>
        )}
      </div>
      <ul
        className="m-0 flex flex-[1_1_360px] list-none flex-col gap-2 p-0"
        aria-label={t("final.answers")}
      >
        {(final?.answers ?? []).map((a) => {
          const p = findPlayer(session, a.playerId);
          const bid = finalBid(session, a.playerId) ?? 0;
          const pending = a.isCorrect == null && !a.autoLoss;
          return (
            <li
              key={a.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-md border px-4 py-3",
                pending ? "border-accent-line bg-accent-surface" : "border-line",
              )}
              data-testid="final-answer"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-muted">
                  {p?.meta.username} · {t("final.bid")}{" "}
                  <b className="font-mono text-text">{formatScore(bid)}</b>
                </span>
                <span className="text-lg [overflow-wrap:anywhere]">
                  {a.answer ? `“${a.answer}”` : t("final.noAnswer")}
                </span>
              </div>
              {pending ? (
                isShowman ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="min-h-11 rounded-[12px] border border-success-line bg-success-surface px-4 font-semibold text-success"
                      onClick={() =>
                        connection.emit("final-answer-review", { answerId: a.id, isCorrect: true })
                      }
                    >
                      {t("judge.correct")} {formatSigned(bid)}
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-[12px] border border-danger/40 bg-danger-surface px-4 font-semibold text-danger"
                      onClick={() =>
                        connection.emit("final-answer-review", { answerId: a.id, isCorrect: false })
                      }
                    >
                      {t("judge.wrong")} {formatSigned(-bid)}
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
                    a.isCorrect ? "text-success" : "text-danger",
                  )}
                >
                  {a.autoLoss
                    ? t("final.autoLoss", { points: formatSigned(-bid) })
                    : a.isCorrect
                      ? `${t("judge.correct")} · ${formatSigned(bid)}`
                      : `${t("judge.wrong")} · ${formatSigned(-bid)}`}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
