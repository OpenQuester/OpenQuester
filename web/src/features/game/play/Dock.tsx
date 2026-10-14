import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { GameSession } from "@/game/reducer";
import {
  canBuzz,
  finalBid,
  findPlayer,
  hasSkipped,
  isEligible,
  isSingleAnswerer,
  me as findMe,
  myRole,
  phaseOf,
  questionValue,
  remainingFinalThemes,
  seatedPlayers,
  stakeInfo,
  wrongCostsPoints,
  type DisabledReason,
  type Phase,
} from "@/game/selectors";
import { useGameStore } from "@/game/store";
import { formatScore, formatSigned } from "@/lib/format";
import { useCountdown } from "@/lib/useCountdown";
import { Button } from "@/ui/Button";
import { TextInput } from "@/ui/Field";
import { TimerRing } from "@/ui/TimerRing";

import { useGame, useSession } from "../GameContext";
import { useSecretTarget } from "./secretTarget";
import { useBuzzer } from "./useBuzzer";

const RING_COLORS: Partial<Record<Phase, string>> = {
  media: "var(--oq-info)",
  answering: "var(--oq-success)",
  reveal: "var(--oq-success)",
  final_reviewing: "var(--oq-success)",
  finished: "var(--oq-success)",
};

/**
 * The bottom action dock. Left: timer and what is happening. Middle: the one
 * thing you can do now, or why you can't. Right: what happens next.
 */
export function Dock() {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const connection = useGameStore((s) => s.connection);
  const phase = phaseOf(session);
  const s = session.state;
  const paused = s.isPaused;
  // While media loads there is no countdown to show: the question timer only
  // starts once every player has the question in front of them.
  const { left, fraction } = useCountdown(
    phase === "finished" || phase === "media" ? null : s.timer,
    paused,
  );
  const model = useDockModel(session, myId);
  const offline = connection !== "connected";

  const ringLabel =
    phase === "finished"
      ? "✓"
      : offline
        ? "…"
        : paused
          ? "II"
          : left == null
            ? (model.ringLabel ?? "")
            : undefined;

  return (
    <div
      role="region"
      aria-label={t("dock.region")}
      className="sticky bottom-0 z-30 border-t border-line-strong bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      data-testid="dock"
    >
      <div className="mx-auto flex max-w-[1320px] 3xl:max-w-[1760px] 4xl:max-w-[2240px] flex-col gap-3 px-3 py-3 sm:px-6 md:flex-row md:items-center md:gap-6 md:py-4">
        <div className="flex min-w-0 items-center gap-3.5 md:flex-[1_1_260px]">
          <TimerRing
            fraction={paused || offline ? null : fraction}
            leftMs={left}
            label={ringLabel}
            color={
              offline
                ? "var(--oq-danger)"
                : paused || (left == null && phase !== "finished")
                  ? "var(--oq-border-strong)"
                  : (RING_COLORS[phase] ?? "var(--oq-accent)")
            }
            size={52}
          />
          <div className="flex min-w-0 flex-col">
            <span
              className="text-[13px] font-semibold uppercase tracking-[0.06em] text-info-soft"
              data-testid="dock-phase"
            >
              {offline ? t("dock.reconnecting") : paused ? t("dock.paused") : t(`phases.${phase}`)}
            </span>
            <span
              className="truncate text-[17px] font-semibold 3xl:text-xl"
              data-testid="dock-status"
            >
              {model.status}
            </span>
          </div>
        </div>
        <div className="flex min-w-0 flex-col items-stretch gap-2 md:flex-[0_1_460px] md:items-center">
          {offline ? (
            <Info>{t("dock.offlineInfo")}</Info>
          ) : paused ? (
            <Info>{t("dock.pausedInfo")}</Info>
          ) : (
            model.action
          )}
        </div>
        {model.next && (
          <p className="m-0 hidden min-w-0 flex-col gap-0.5 text-sm text-muted md:flex md:flex-[1_1_260px]">
            <span className="font-semibold text-text">{t("dock.next")}</span>
            <span>{model.next}</span>
          </p>
        )}
        {model.next && (
          <p className="m-0 text-[13px] leading-snug text-muted md:hidden">{model.next}</p>
        )}
      </div>
    </div>
  );
}

function Info({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div
      className="flex min-h-14 w-full items-center justify-center rounded-md border border-line-strong bg-surface-2 px-4 py-2 text-center text-[15px] text-soft"
      data-testid={testId ?? "dock-info"}
    >
      {children}
    </div>
  );
}

interface DockModel {
  status: string;
  action: ReactNode;
  next: string;
  ringLabel?: string;
}

type T = (key: string, options?: Record<string, unknown>) => string;

interface DockCtx {
  t: T;
  session: GameSession;
  myId: number;
  connection: ReturnType<typeof useGame>["connection"];
  secretTarget: number | null;
  setSecretTarget: (id: number | null) => void;
}

function useDockModel(session: GameSession, myId: number): DockModel {
  const { t } = useTranslation();
  const { connection } = useGame();
  const pending = useGameStore((s) => s.pending);
  const [secretTarget, setSecretTarget] = useSecretTarget();
  const buzzer = useBuzzer(session, myId);
  const ctx: DockCtx = { t, session, myId, connection, secretTarget, setSecretTarget };
  const phase = phaseOf(session);
  const role = myRole(session, myId);
  const s = session.state;
  const name = (id: number | null | undefined) =>
    findPlayer(session, id)?.meta.username ?? t("chips.someone");
  const value = questionValue(session);
  const sending = (action: string) => pending?.action === action;
  const reason = (r: DisabledReason) => t(`reasons.${r}`);

  switch (phase) {
    case "choosing": {
      const picker = s.currentTurnPlayerId;
      const mine = picker === myId;
      if (role === "showman") {
        return {
          status: picker
            ? t("dock.choosing.showmanStatus", { name: name(picker) })
            : session.turnUnknown
              ? t("dock.choosing.unknownShowman")
              : t("dock.choosing.youPick"),
          action: (
            <div className="flex w-full flex-wrap justify-center gap-2">
              <Info>
                {picker
                  ? t("dock.choosing.showmanInfo", { name: name(picker) })
                  : t("dock.choosing.pickAny")}
              </Info>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => connection.emit("next-round")}
                disabled={sending("next-round")}
              >
                {t("dock.choosing.nextRound")}
              </Button>
            </div>
          ),
          next: t("dock.choosing.next"),
        };
      }
      if (session.turnUnknown && !picker) {
        return {
          status: t("dock.choosing.unknown"),
          action: (
            <Info>
              {role === "spectator" ? t("dock.choosing.watching") : t("dock.choosing.unknownInfo")}
            </Info>
          ),
          next: t("dock.choosing.next"),
        };
      }
      return {
        status: mine
          ? t("dock.choosing.yourTurn")
          : picker
            ? t("dock.choosing.isPicking", { name: name(picker) })
            : t("dock.choosing.showmanPicks"),
        action: (
          <Info>
            {mine
              ? t("dock.choosing.pickInfo")
              : role === "spectator"
                ? t("dock.choosing.watching")
                : reason("not_your_turn")}
          </Info>
        ),
        next: mine ? t("dock.choosing.nextYou") : t("dock.choosing.next"),
      };
    }

    case "media": {
      const players = seatedPlayers(session).filter((p) => p.status === "in-game");
      const ready = players.filter((p) => p.mediaDownloaded).length;
      return {
        status: t("dock.media.status", { ready, total: players.length }),
        ringLabel: `${ready}/${players.length}`,
        action: <Info>{reason("waiting_for_media")}</Info>,
        next: t("dock.media.next"),
      };
    }

    case "showing": {
      const wrongPart = wrongCostsPoints(session)
        ? t("dock.showing.wrongCost", { points: formatScore(value) })
        : t("dock.showing.wrongFree");
      const next = t(
        session.settings?.buttonPressMode === "random_within_window"
          ? "dock.showing.nextWindow"
          : "dock.showing.next",
        { points: formatScore(value), wrong: wrongPart },
      );
      if (role === "showman") {
        return {
          status: t("dock.showing.showmanStatus"),
          action: (
            <Button
              variant="ghost"
              fullWidth
              onClick={() => connection.emit("skip-question-force")}
              disabled={sending("skip-question-force")}
            >
              {t("dock.showing.revealAnswer")}
            </Button>
          ),
          next: t("dock.showing.showmanNext"),
        };
      }
      if (role === "spectator") {
        return {
          status: t("dock.showing.status"),
          action: <Info>{t("reasons.wrong_role_watch")}</Info>,
          next,
        };
      }
      const can = canBuzz(session, myId);
      if (!can.ok) {
        const skipped = hasSkipped(session, myId);
        return {
          status: t("dock.showing.status"),
          action: (
            <div className="flex w-full flex-col gap-2">
              <Info>
                {can.reason === "false_start"
                  ? t("dock.showing.locked", { seconds: Math.ceil(buzzer.lockLeftMs / 1000) })
                  : reason(can.reason)}
              </Info>
              {skipped && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => connection.emit("question-unskip")}
                >
                  {t("dock.showing.unpass")}
                </Button>
              )}
            </div>
          ),
          next,
        };
      }
      // Before the buzzer opens the button stays pressable (an early press is a
      // false start) but reads as "wait" so nobody mistakes it for open.
      const early = !buzzer.open;
      return {
        status: early ? t("dock.showing.wait") : t("dock.showing.open"),
        action: (
          <div className="flex w-full flex-col items-stretch gap-2 md:flex-row md:items-center">
            <Button
              variant={early ? "secondary" : "accent"}
              size="xl"
              className={cn("flex-1", !early && "oq-pulse")}
              onClick={() => connection.emit("question-answer")}
              disabled={sending("question-answer")}
              aria-describedby={early ? "buzz-early-hint" : undefined}
              data-testid="buzz"
              data-early={early || undefined}
            >
              {sending("question-answer")
                ? t("dock.sending")
                : early
                  ? t("dock.showing.waitButton")
                  : t("dock.showing.buzz")}
              <kbd className="hidden font-mono text-sm md:inline">{t("keys.space")}</kbd>
            </Button>
            {early && (
              <span id="buzz-early-hint" className="text-sm text-soft md:max-w-[14rem]">
                {t("dock.showing.earlyHint")}
              </span>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => connection.emit("question-skip")}
              disabled={sending("question-skip")}
            >
              {t("dock.showing.pass")}
            </Button>
          </div>
        ),
        next,
      };
    }

    case "answering": {
      const answerer = s.answeringPlayer;
      const q = s.currentQuestion;
      const single = isSingleAnswerer(q);
      if (role === "showman") {
        const wrong = wrongCostsPoints(session) ? -value : 0;
        return {
          status: t("dock.answering.judge", { name: name(answerer) }),
          action: (
            <div className="flex w-full gap-2">
              <Button
                variant="success"
                size="lg"
                className="flex-1"
                data-testid="judge-correct"
                disabled={sending("answer-result")}
                onClick={() =>
                  connection.emit("answer-result", { scoreResult: value, answerType: "correct" })
                }
              >
                {t("judge.correct")} {formatSigned(value)}{" "}
                <kbd className="hidden text-xs opacity-70 md:inline">C</kbd>
              </Button>
              <Button
                variant="danger"
                size="lg"
                className="flex-1"
                data-testid="judge-wrong"
                disabled={sending("answer-result")}
                onClick={() =>
                  connection.emit("answer-result", {
                    scoreResult: wrong === 0 ? -value : wrong,
                    answerType: "wrong",
                  })
                }
              >
                {t("judge.wrong")} {wrong === 0 ? "±0" : formatSigned(wrong)}{" "}
                <kbd className="hidden text-xs opacity-70 md:inline">W</kbd>
              </Button>
            </div>
          ),
          next:
            q?.type === "choice"
              ? t("dock.answering.showmanChoice", { name: name(answerer) })
              : single
                ? t("dock.answering.showmanNextSingle", { name: name(answerer) })
                : t("dock.answering.showmanNext", {
                    name: name(answerer),
                    points: formatScore(value),
                  }),
        };
      }
      if (answerer === myId) {
        return {
          status: t("dock.answering.you"),
          action:
            q?.type === "choice" ? (
              <Info>{t("dock.answering.pickOption")}</Info>
            ) : (
              <AnswerBox giveUp={single} />
            ),
          next: single ? t("dock.answering.youNextSingle") : t("dock.answering.youNext"),
        };
      }
      return {
        status: t("dock.answering.other", { name: name(answerer) }),
        action: (
          <Info>
            {role === "spectator" ? t("reasons.wrong_role_watch") : t("dock.answering.wait")}
          </Info>
        ),
        next: single
          ? t("dock.answering.otherNextSingle", { name: name(answerer) })
          : t("dock.answering.otherNext"),
      };
    }

    case "reveal": {
      const result = s.answerShowData?.answerResult ?? (s.answeredPlayers ?? []).at(-1);
      const correct = result?.answerType === "correct";
      const nextPicker = s.answerShowData?.nextTurnPlayerId ?? s.currentTurnPlayerId;
      return {
        status: correct
          ? t("dock.reveal.correct", {
              name: name(result?.player),
              points: formatSigned(result!.result),
            })
          : t("dock.reveal.nobody"),
        action:
          role === "showman" ? (
            <Button
              variant="accent"
              size="lg"
              fullWidth
              onClick={() => connection.emit("skip-show-answer")}
              disabled={sending("skip-show-answer")}
              data-testid="continue"
            >
              {t("dock.reveal.continue")}
            </Button>
          ) : (
            <Info>{t("dock.reveal.info")}</Info>
          ),
        next: nextPicker
          ? t("dock.reveal.next", { name: name(nextPicker) })
          : t("dock.reveal.nextBoard"),
      };
    }

    case "secret_transfer":
      return secretModel(ctx);

    case "stake_bidding":
      return stakeModel(ctx);

    case "final_elimination": {
      const turn = s.currentTurnPlayerId;
      const left = remainingFinalThemes(session).length;
      return {
        status:
          turn === myId
            ? t("dock.final.elimYou")
            : role === "showman"
              ? t("dock.final.elimShowman", { name: name(turn) })
              : t("dock.final.elimOther", { name: name(turn) }),
        action: (
          <Info>
            {turn === myId || role === "showman"
              ? t("dock.final.elimInfo")
              : reason("not_your_turn")}
          </Info>
        ),
        next: t("dock.final.elimNext", { count: left }),
      };
    }

    case "final_bidding":
      return finalBidModel(ctx);

    case "final_answering":
      return finalAnswerModel(ctx);

    case "final_reviewing": {
      const answers = s.finalRoundData?.answers ?? [];
      const done = answers.filter((a) => a.isCorrect != null || a.autoLoss).length;
      return {
        status: t("dock.final.reviewStatus", { done, total: answers.length }),
        action: (
          <Info>
            {role === "showman" ? t("dock.final.reviewShowman") : t("dock.final.reviewWait")}
          </Info>
        ),
        next: t("dock.final.reviewNext"),
        ringLabel: `${done}/${answers.length}`,
      };
    }

    case "finished": {
      const mePlayer = findMe(session, myId);
      const ranked = seatedPlayers(session).sort((a, b) => b.score - a.score);
      const place =
        mePlayer?.role === "player" ? ranked.findIndex((p) => p.meta.id === myId) + 1 : 0;
      return {
        status: place > 0 ? t("dock.finished.place", { n: place }) : t("dock.finished.status"),
        action: (
          <Link
            to="/"
            className="flex min-h-14 w-full items-center justify-center rounded-md border-2 border-accent-strong bg-accent text-lg font-semibold text-on-accent no-underline hover:text-on-accent"
            data-testid="back-to-games"
          >
            {t("dock.finished.back")}
          </Link>
        ),
        next: t("dock.finished.next"),
      };
    }

    default:
      return { status: "", action: null, next: "" };
  }
}

/** Optional typed answer for the showman; most people answer out loud. */
function AnswerBox({ giveUp }: { giveUp: boolean }) {
  const { t } = useTranslation();
  const { connection } = useGame();
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    connection.emit("answer-submitted", { answerText: text.trim() });
    setSent(true);
  }
  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-2">
      <div className="flex w-full gap-2">
        <label htmlFor="answer-text" className="sr-only">
          {t("dock.answering.typeLabel")}
        </label>
        <TextInput
          id="answer-text"
          value={text}
          autoFocus
          maxLength={255}
          onChange={(e) => {
            setText(e.target.value);
            setSent(false);
          }}
          placeholder={t("dock.answering.typePlaceholder")}
          data-no-shortcuts
        />
        <Button type="submit" variant="accent" disabled={!text.trim() || sent}>
          {sent ? t("dock.answering.sent") : t("dock.answering.send")}
        </Button>
      </div>
      {giveUp && (
        <Button size="sm" variant="ghost" onClick={() => connection.emit("question-skip")}>
          {t("dock.answering.giveUp")}
        </Button>
      )}
    </form>
  );
}

function secretModel({
  t,
  session,
  myId,
  connection,
  secretTarget: target,
  setSecretTarget: setTarget,
}: DockCtx): DockModel {
  const secret = session.state.secretQuestionData;
  const role = myRole(session, myId);
  const picker = findPlayer(session, secret?.pickerPlayerId);
  const canChoose = secret?.pickerPlayerId === myId || role === "showman";
  const targetPlayer = findPlayer(session, target);
  const price = session.state.currentQuestion?.price;
  return {
    status: canChoose
      ? targetPlayer
        ? t("dock.secret.giveQ", { name: targetPlayer.meta.username })
        : t("dock.secret.choose")
      : t("dock.secret.otherChoosing", { name: picker?.meta.username ?? "" }),
    action: canChoose ? (
      <Button
        variant="accent"
        size="lg"
        fullWidth
        inactive={!targetPlayer}
        onClick={() => {
          if (!targetPlayer) return;
          connection.emit("secret-question-transfer", { targetPlayerId: targetPlayer.meta.id });
          setTarget(null);
        }}
        data-testid="secret-give"
      >
        {targetPlayer
          ? t("dock.secret.give", { name: targetPlayer.meta.username })
          : t("dock.secret.pickFirst")}
      </Button>
    ) : (
      <Info>{t("dock.secret.wait")}</Info>
    ),
    next:
      price != null
        ? t("dock.secret.next", { points: formatScore(price) })
        : t("dock.secret.nextNoPrice"),
  };
}

function stakeModel({ t, session, myId, connection }: DockCtx): DockModel {
  const info = stakeInfo(session);
  const mePlayer = findMe(session, myId);
  const myScore = mePlayer?.score ?? 0;
  const myTurn = info?.bidderId === myId && info?.stake.biddingPhase;
  const max = Math.min(
    info?.stake.maxPrice ?? Number.POSITIVE_INFINITY,
    Math.max(myScore, info?.minBid ?? 0),
  );
  const bidder = findPlayer(session, info?.bidderId);
  const next = t("dock.stake.next");
  if (!info) return { status: "", action: null, next };
  if (!myTurn) {
    return {
      status: t("dock.stake.waitFor", { name: bidder?.meta.username ?? "" }),
      action: (
        <Info>
          {myRole(session, myId) === "player"
            ? reason(t, info.stake.passedPlayers.includes(myId) ? "already_done" : "not_your_turn")
            : t("dock.stake.watching")}
        </Info>
      ),
      next,
    };
  }
  return {
    status:
      info.stake.highestBid != null
        ? t("dock.stake.beat", { amount: formatScore(info.stake.highestBid) })
        : t("dock.stake.open"),
    action: (
      <BidControls
        min={info.minBid}
        max={Number.isFinite(max) ? max : info.minBid}
        allIn={myScore > (info.stake.highestBid ?? 0) ? myScore : null}
        onBid={(amount) =>
          connection.emit("stake-bid-submit", { bidType: "normal", bidAmount: amount })
        }
        onAllIn={() => connection.emit("stake-bid-submit", { bidType: "all-in", bidAmount: null })}
        onPass={() => connection.emit("stake-bid-submit", { bidType: "pass", bidAmount: null })}
      />
    ),
    next,
  };
}

function reason(t: T, r: DisabledReason) {
  return t(`reasons.${r}`);
}

function finalBidModel({ t, session, myId, connection }: DockCtx): DockModel {
  const role = myRole(session, myId);
  const mePlayer = findMe(session, myId);
  const players = seatedPlayers(session).filter((p) => isEligible(session, p.meta.id));
  const placed = players.filter((p) => finalBid(session, p.meta.id) != null).length;
  const myBid = finalBid(session, myId);
  const next = t("dock.final.bidNext");
  if (role !== "player") {
    return {
      status: t("dock.final.bidsIn", { done: placed, total: players.length }),
      action: <Info>{t("dock.final.bidShowman")}</Info>,
      next,
    };
  }
  if (!isEligible(session, myId) || (mePlayer?.score ?? 0) <= 0) {
    return {
      status: t("dock.final.sitOut"),
      action: <Info>{reason(t, "not_eligible")}</Info>,
      next,
    };
  }
  if (myBid != null) {
    return {
      status: t("dock.final.bidLocked", { amount: formatScore(myBid) }),
      action: <Info>{t("dock.final.waitOthers", { done: placed, total: players.length })}</Info>,
      next,
    };
  }
  const score = mePlayer!.score;
  return {
    status: t("dock.final.bidRange", { max: formatScore(score) }),
    action: (
      <BidControls
        min={1}
        max={score}
        allIn={score}
        onBid={(amount) => connection.emit("final-bid-submit", { bid: amount })}
        cta={t("dock.final.placeBid")}
      />
    ),
    next,
  };
}

function finalAnswerModel({ t, session, myId }: DockCtx): DockModel {
  const role = myRole(session, myId);
  const players = seatedPlayers(session).filter(
    (p) => isEligible(session, p.meta.id) && finalBid(session, p.meta.id) != null,
  );
  const done = players.filter((p) => session.finalSubmitted.includes(p.meta.id)).length;
  const next = t("dock.final.answerNext");
  if (role !== "player") {
    return {
      status: t("dock.final.answersIn", { done, total: players.length }),
      action: <Info>{t("dock.final.answerShowman")}</Info>,
      next,
    };
  }
  if (finalBid(session, myId) == null || !isEligible(session, myId)) {
    return {
      status: t("dock.final.sitOut"),
      action: <Info>{reason(t, "not_eligible")}</Info>,
      next,
    };
  }
  if (session.finalSubmitted.includes(myId)) {
    return {
      status: t("dock.final.answerLocked"),
      action: <Info>{t("dock.final.waitOthers", { done, total: players.length })}</Info>,
      next,
    };
  }
  return {
    status: t("dock.final.typeAnswer", { amount: formatScore(finalBid(session, myId) ?? 0) }),
    action: <FinalAnswerBox />,
    next,
  };
}

function FinalAnswerBox() {
  const { t } = useTranslation();
  const session = useSession();
  const { connection } = useGame();
  const [text, setText] = useState("");
  const sentRef = useRef(false);
  const { left } = useCountdown(session.state.timer, session.state.isPaused);

  const submit = (value: string) => {
    if (sentRef.current) return;
    sentRef.current = true;
    connection.emit("final-answer-submit", { answerText: value.trim() });
  };

  // At the buzzer, send whatever was typed rather than losing it.
  useEffect(() => {
    if (left != null && left < 900 && text.trim()) submit(text);
  });

  return (
    <form
      className="flex w-full gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) submit(text);
      }}
    >
      <label htmlFor="final-answer" className="sr-only">
        {t("dock.final.answerLabel")}
      </label>
      <TextInput
        id="final-answer"
        value={text}
        autoFocus
        maxLength={255}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("dock.final.answerPlaceholder")}
        data-no-shortcuts
      />
      <Button type="submit" variant="accent" disabled={!text.trim()} data-testid="final-submit">
        {t("dock.final.submit")}
      </Button>
    </form>
  );
}

function BidControls({
  min,
  max,
  allIn,
  onBid,
  onAllIn,
  onPass,
  cta,
}: {
  min: number;
  max: number;
  allIn: number | null;
  onBid: (amount: number) => void;
  onAllIn?: () => void;
  onPass?: () => void;
  cta?: string;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(String(min));
  const amount = Number(value);
  const valid = Number.isInteger(amount) && amount >= min && amount <= max;
  const quick = [...new Set([min, Math.round((min + max) / 2 / 100) * 100, max])].filter(
    (v) => v >= min && v <= max && v > 0,
  );
  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onBid(amount);
      }}
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("bid.quick")}>
        {quick.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setValue(String(q))}
            className={cn(
              "min-h-10 rounded-full border px-3.5 font-mono text-sm",
              Number(value) === q
                ? "border-accent bg-accent-surface text-accent-strong"
                : "border-line-strong text-text",
            )}
          >
            {formatScore(q)}
          </button>
        ))}
        {allIn != null && onAllIn && (
          <button
            type="button"
            onClick={onAllIn}
            className="min-h-10 rounded-full border border-accent-line px-3.5 text-sm font-semibold text-accent-strong"
          >
            {t("bid.allIn", { amount: formatScore(allIn) })}
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <label htmlFor="bid-amount" className="sr-only">
          {t("bid.amount")}
        </label>
        <TextInput
          id="bid-amount"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
          className="w-28 flex-none font-mono"
          aria-invalid={!valid || undefined}
          data-no-shortcuts
        />
        <Button
          type="submit"
          variant="accent"
          className="flex-1"
          inactive={!valid}
          data-testid="bid-submit"
        >
          {valid
            ? (cta ?? t("bid.bid", { amount: formatScore(amount) }))
            : t("bid.range", { min: formatScore(min), max: formatScore(max) })}
        </Button>
        {onPass && (
          <Button variant="ghost" onClick={onPass} data-testid="bid-pass">
            {t("bid.pass")}
          </Button>
        )}
      </div>
    </form>
  );
}
