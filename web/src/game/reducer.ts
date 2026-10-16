import { serverNow } from "@/lib/clock";

import { buildContentPlan, timerElapsed } from "./contentPlan";
import type {
  AnsweredPlayer,
  ChatMessage,
  ContentPlan,
  FinalRoundData,
  GameJoinData,
  GameSettings,
  AllPlayData,
  AllPlayEntry,
  GameState,
  Player,
  Question,
  Round,
  ServerEvent,
  Timer,
} from "./protocol";

/**
 * The content timeline on screen and the clock it runs on.
 *
 * Question content runs on the SHOWING timer (or the answering timer of a
 * stake/secret winner); while someone buzzed in, it freezes where it was.
 * Answer content runs on the reveal timer.
 */
export interface ContentClock {
  kind: "question" | "answer";
  plan: ContentPlan;
  /** Null when the position is unknown (joined mid-answer): show the end. */
  timer: Timer | null;
  /** Position while frozen (someone is answering). */
  frozenAtMs: number | null;
}

/**
 * Everything the client knows about one joined game.
 *
 * The server is authoritative: this state only changes in response to server
 * events, never optimistically. A fresh `game-data` snapshot (sent on every
 * join and rejoin) replaces it wholesale.
 */
export interface GameSession {
  gameId: string;
  title: string;
  /** The game's rules; absent on servers that predate settings. */
  settings: GameSettings | null;
  players: Player[];
  state: GameState;
  chat: ChatMessage[];
  finished: boolean;
  /** Text the answering player typed, shown to the showman. */
  submittedAnswer: string | null;
  /** Most recent judged answer, for result feedback. */
  lastResult: (AnsweredPlayer & { key: number }) | null;
  /** Final round: players whose answer is in (text hidden until review). */
  finalSubmitted: number[];
  /** Final round: players who lost automatically and why. */
  finalAutoLoss: Record<number, "empty_answer" | "timeout">;
  /** Bumps on each applied event so views can key animations. */
  version: number;
  /**
   * True when the game started on a server that does not announce the first
   * picker. Players may then try to pick; the server decides whose turn it is.
   */
  turnUnknown: boolean;
  /** Question or answer content timeline, when there is one to play. */
  content: ContentClock | null;
}

export function sessionFromSnapshot(gameId: string, data: GameJoinData): GameSession {
  const state = normalizeState(data.gameState);
  const finalData = state.finalRoundData;
  return {
    gameId,
    title: data.meta.title,
    settings: data.meta.settings ?? null,
    players: data.players,
    state,
    // The server sends the history newest first; the chat reads top to bottom.
    chat: [...(data.chatMessages ?? [])].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    ),
    finished: false,
    submittedAnswer: null,
    lastResult: null,
    finalSubmitted: finalData ? finalData.answers.map((a) => a.playerId) : [],
    finalAutoLoss: finalData
      ? Object.fromEntries(
          finalData.answers
            .filter((a) => a.autoLoss)
            .map((a) => [a.playerId, "empty_answer" as const]),
        )
      : {},
    version: 0,
    turnUnknown: false,
    content: contentFromSnapshot(state),
  };
}

/** The question's own plan, or one built locally when the server sent none. */
function questionPlan(question: Question | null, sent: ContentPlan | null | undefined) {
  if (sent !== undefined) return sent;
  if (!question) return null;
  return buildContentPlan({
    text: question.text,
    textOrder: question.textOrder,
    files: question.questionFiles,
  });
}

function answerPlan(data: GameState["answerShowData"]): ContentPlan | null {
  if (!data) return null;
  if (data.answerContentPlan !== undefined) return data.answerContentPlan;
  return buildContentPlan({ files: data.answerFiles });
}

/** Stake/secret winners answer directly: the content runs on their timer. */
function isDirectAnswer(s: GameState): boolean {
  return (
    s.questionState === "answering" &&
    (s.stakeQuestionData?.winnerPlayerId != null ||
      ((s.currentQuestion?.type === "secret" || s.currentQuestion?.type === "stake") &&
        (s.answeredPlayers ?? []).length === 0))
  );
}

function contentFromSnapshot(s: GameState): ContentClock | null {
  if (s.questionState === "showing_answer") {
    const plan = answerPlan(s.answerShowData);
    return plan ? { kind: "answer", plan, timer: s.timer, frozenAtMs: null } : null;
  }
  if (s.questionState === "showing" || s.questionState === "answering") {
    const plan = questionPlan(s.currentQuestion, s.questionContentPlan);
    if (!plan) return null;
    const running = s.questionState === "showing" || isDirectAnswer(s);
    return { kind: "question", plan, timer: running ? s.timer : null, frozenAtMs: null };
  }
  return null;
}

/** Wall-clock start for the reveal timeline (its timer is not broadcast). */
function localTimer(durationMs: number): Timer {
  return {
    startedAt: new Date(serverNow()).toISOString(),
    durationMs,
    elapsedMs: 0,
    resumedAt: null,
  };
}

function normalizeState(s: GameState): GameState {
  return {
    ...s,
    questionState: s.questionState ?? null,
    currentRound: s.currentRound ?? null,
    currentQuestion: s.currentQuestion ?? null,
    answeringPlayer: s.answeringPlayer ?? null,
    answeredPlayers: s.answeredPlayers ?? null,
    readyPlayers: s.readyPlayers ?? null,
    skippedPlayers: s.skippedPlayers ?? null,
    timer: s.timer ?? null,
  };
}

/** Whether the game has left the lobby. */
export function isStarted(session: GameSession): boolean {
  return session.state.currentRound != null;
}

function patchState(session: GameSession, patch: Partial<GameState>): GameSession {
  return { ...session, state: { ...session.state, ...patch } };
}

function patchPlayer(
  players: Player[],
  id: number,
  update: (p: Player) => Player | null,
): Player[] {
  const out: Player[] = [];
  for (const p of players) {
    if (p.meta.id !== id) {
      out.push(p);
      continue;
    }
    const next = update(p);
    if (next) out.push(next);
  }
  return out;
}

function markQuestionPlayed(round: Round | null, questionId: number | undefined): Round | null {
  if (!round || questionId == null) return round;
  let changed = false;
  const themes = round.themes.map((theme) => ({
    ...theme,
    questions: theme.questions.map((q) => {
      if (q.id !== questionId || q.isPlayed) return q;
      changed = true;
      return { ...q, isPlayed: true };
    }),
  }));
  return changed ? { ...round, themes } : round;
}

function patchFinal(session: GameSession, patch: Partial<FinalRoundData>): GameSession {
  const current = session.state.finalRoundData;
  if (!current) return session;
  return patchState(session, { finalRoundData: { ...current, ...patch } });
}

function eligibleInGamePlayers(session: GameSession): Player[] {
  return session.players.filter((p) => p.role === "player" && p.status === "in-game");
}

/** Clears per-question data when the board comes back. */
function backToChoosing(session: GameSession): GameSession {
  return {
    ...patchState(session, {
      questionState: "choosing",
      currentQuestion: null,
      answeringPlayer: null,
      answeredPlayers: null,
      skippedPlayers: null,
      answerShowData: null,
      secretQuestionData: null,
      stakeQuestionData: null,
      questionEligiblePlayers: null,
      timer: null,
      allPlay: null,
      buzzerOpensAtMs: null,
      buzzerLocks: null,
    }),
    submittedAnswer: null,
    content: null,
    players: session.players.map((p) => ({ ...p, mediaDownloaded: false })),
  };
}

function onQuestionData(
  session: GameSession,
  data: Question,
  timer: Timer,
  eligible?: number[] | null,
  sentPlan?: ContentPlan | null,
  buzzerOpensAtMs?: number | null,
) {
  const s = session.state;
  const stake = s.stakeQuestionData;
  const secret = s.secretQuestionData;
  const newPick = s.questionState == null || s.questionState === "choosing";
  let questionState: GameState["questionState"] = s.questionState;
  let answeringPlayer = s.answeringPlayer;

  if (s.allPlay && s.questionState === "bidding") {
    // Stake for everyone: stakes are in, the question now preloads.
    questionState = "media_downloading";
    answeringPlayer = null;
  } else if (stake?.winnerPlayerId != null) {
    questionState = "answering";
    answeringPlayer = stake.winnerPlayerId;
  } else if (secret && s.answeringPlayer != null) {
    questionState = "answering";
  } else if (!newPick) {
    // Re-sent after a (re)join: the snapshot already has the right phase.
  } else if (data.type === "secret" || data.type === "stake") {
    // No eligible player for the special mechanic: the server falls back to a
    // normal question, answered directly when exactly one player is left.
    const players = eligibleInGamePlayers(session);
    if (players.length === 1) {
      questionState = "answering";
      answeringPlayer = players[0]!.meta.id;
    } else {
      questionState = "showing";
      answeringPlayer = null;
    }
  } else {
    questionState = "media_downloading";
    answeringPlayer = null;
  }

  return {
    ...patchState(session, {
      questionState,
      currentQuestion: data,
      currentRound: markQuestionPlayed(s.currentRound, data.id),
      timer,
      answeringPlayer,
      answeredPlayers: newPick ? null : s.answeredPlayers,
      skippedPlayers: newPick ? null : s.skippedPlayers,
      answerShowData: newPick ? null : s.answerShowData,
      questionEligiblePlayers: eligible ?? s.questionEligiblePlayers ?? null,
      buzzerOpensAtMs:
        buzzerOpensAtMs !== undefined ? buzzerOpensAtMs : newPick ? null : s.buzzerOpensAtMs,
      buzzerLocks: newPick ? null : s.buzzerLocks,
      // An "everyone answers" question announces itself just before its data;
      // anything left from an earlier question is dropped.
      allPlay: s.allPlay?.questionId === data.id ? s.allPlay : null,
    }),
    submittedAnswer: newPick ? null : session.submittedAnswer,
    content: questionContent(session, questionState, data, timer, sentPlan, newPick),
    players:
      newPick && questionState === "media_downloading"
        ? session.players.map((p) => ({ ...p, mediaDownloaded: false }))
        : session.players,
  };
}

function questionContent(
  session: GameSession,
  questionState: GameState["questionState"],
  question: Question,
  timer: Timer,
  sentPlan: ContentPlan | null | undefined,
  newPick: boolean,
): ContentClock | null {
  // Preloading: the plan and its timer arrive with media-download-status.
  if (questionState === "media_downloading") return null;
  // Re-sent after a (re)join: the snapshot already placed the timeline (or
  // knows it is frozen while someone answers). Starting it again from this
  // event's timer would replay the media from the top.
  if (!newPick && session.content?.kind === "question") {
    return sentPlan ? { ...session.content, plan: sentPlan } : session.content;
  }
  const plan = questionPlan(question, sentPlan);
  if (!plan) return null;
  // While someone answers, this event carries the answer timer, not the
  // question's: the position is unknown until the question resumes.
  const running =
    newPick || questionState === "showing" || isDirectAnswer({ ...session.state, questionState });
  return { kind: "question", plan, timer: running ? timer : null, frozenAtMs: null };
}

/** Applies one server event. Pure: never mutates `session`. */
export function reduce(session: GameSession, event: ServerEvent): GameSession {
  const next = apply(session, event);
  return next === session ? session : { ...next, version: session.version + 1 };
}

const TURN_EVENTS = new Set<ServerEvent["type"]>([
  "question-finish",
  "turn-player-changed",
  "next-round",
  "question-data",
  "stake-question-picked",
  "secret-question-picked",
]);

function apply(session: GameSession, event: ServerEvent): GameSession {
  const next = applyEvent(session, event);
  return next.turnUnknown && TURN_EVENTS.has(event.type) ? { ...next, turnUnknown: false } : next;
}

function applyEvent(session: GameSession, event: ServerEvent): GameSession {
  const s = session.state;

  switch (event.type) {
    case "game-data":
      return { ...sessionFromSnapshot(session.gameId, event.payload), version: session.version };

    case "join": {
      const player = event.payload;
      const exists = session.players.some((p) => p.meta.id === player.meta.id);
      return {
        ...session,
        players: exists
          ? session.players.map((p) => (p.meta.id === player.meta.id ? player : p))
          : [...session.players, player],
      };
    }

    case "user-leave":
      return {
        ...session,
        players: patchPlayer(session.players, event.payload.user, (p) => ({
          ...p,
          status: "disconnected",
        })),
      };

    case "player-kicked":
      return {
        ...session,
        players: patchPlayer(session.players, event.payload.playerId, () => null),
      };

    case "start":
      return {
        ...patchState(session, {
          currentRound: event.payload.currentRound,
          questionState: "choosing",
          readyPlayers: null,
          roundStartedAt: event.payload.roundStartedAt ?? serverNow(),
          roundPausedMs: 0,
          pausedAt: null,
          currentTurnPlayerId:
            event.payload.currentTurnPlayerId !== undefined
              ? event.payload.currentTurnPlayerId
              : s.currentTurnPlayerId,
        }),
        turnUnknown: event.payload.currentTurnPlayerId === undefined,
      };

    case "game-pause":
      return {
        ...patchState(session, {
          isPaused: true,
          timer: event.payload.timer ?? s.timer,
          pausedAt: serverNow(),
        }),
        content: retime(session.content, event.payload.timer),
      };

    case "game-unpause":
      return {
        ...patchState(session, {
          isPaused: false,
          timer: event.payload.timer ?? null,
          roundPausedMs:
            (s.roundPausedMs ?? 0) + (s.pausedAt ? Math.max(0, serverNow() - s.pausedAt) : 0),
          pausedAt: null,
        }),
        content: retime(session.content, event.payload.timer),
      };

    case "player-ready":
    case "player-unready":
      return patchState(session, { readyPlayers: event.payload.readyPlayers });

    case "media-download-status": {
      const { playerId, mediaDownloaded, allPlayersReady, timer, contentPlan, buzzerOpensAtMs } =
        event.payload;
      let players = session.players;
      if (allPlayersReady) {
        players = players.map((p) => (p.role === "player" ? { ...p, mediaDownloaded: true } : p));
      } else {
        players = patchPlayer(players, playerId, (p) => ({ ...p, mediaDownloaded }));
      }
      const next = { ...session, players };
      if (allPlayersReady && s.questionState === "media_downloading") {
        const plan = questionPlan(s.currentQuestion, contentPlan);
        const clock = timer ?? s.timer;
        return {
          ...patchState(next, {
            questionState: "showing",
            timer: clock,
            buzzerOpensAtMs: buzzerOpensAtMs ?? s.buzzerOpensAtMs ?? null,
            buzzerLocks: null,
          }),
          content: plan ? { kind: "question", plan, timer: clock, frozenAtMs: null } : null,
        };
      }
      return next;
    }

    case "question-data":
      return onQuestionData(
        session,
        event.payload.data,
        event.payload.timer,
        event.payload.questionEligiblePlayers,
        event.payload.contentPlan,
        event.payload.buzzerOpensAtMs,
      );

    case "buzzer-open":
      // The showman opened the buzzer early; any false-start lock is lifted.
      return patchState(session, {
        buzzerOpensAtMs: event.payload.buzzerOpensAtMs,
        buzzerLocks: null,
      });

    case "buzzer-false-start": {
      const { playerId, lockMs } = event.payload;
      return patchState(session, {
        buzzerLocks: { ...(s.buzzerLocks ?? {}), [String(playerId)]: serverNow() + lockMs },
      });
    }

    case "question-answer":
      return {
        ...patchState(session, {
          questionState: "answering",
          answeringPlayer: event.payload.userId,
          timer: event.payload.timer,
        }),
        submittedAnswer: null,
        content: freeze(session.content, s.isPaused),
      };

    case "answer-submitted":
      return { ...session, submittedAnswer: event.payload.answerText };

    case "answer-result": {
      const result = event.payload.answerResult;
      const players = patchPlayer(session.players, result.player, (p) => ({
        ...p,
        score: result.score,
      }));
      const answered = [...(s.answeredPlayers ?? []), result];
      // A wrong answer with a timer reopens the buzzer for the others, except on
      // single-answerer questions (noRisk, stake, secret), which end right away.
      const single = ["noRisk", "stake", "secret"].includes(s.currentQuestion?.type ?? "");
      const reopened = result.answerType !== "correct" && event.payload.timer != null && !single;
      return {
        ...patchState(session, {
          answeringPlayer: null,
          answeredPlayers: answered,
          // A correct answer is followed by question-finish and the reveal.
          questionState: reopened ? "showing" : s.questionState,
          timer: event.payload.timer ?? s.timer,
        }),
        players,
        submittedAnswer: null,
        lastResult: { ...result, key: session.version + 1 },
        // The server restores the showing timer: the content picks up there.
        content:
          reopened && session.content?.kind === "question"
            ? { ...session.content, timer: event.payload.timer, frozenAtMs: null }
            : session.content,
      };
    }

    case "question-finish": {
      const data = event.payload;
      // Final round: this reveals the correct answer after the review.
      if (s.currentRound?.type === "final") {
        return patchState(session, { answerShowData: data });
      }
      const revealPlan = answerPlan(data);
      return {
        ...patchState(session, {
          questionState: "showing_answer",
          answerShowData: data,
          answeringPlayer: null,
          currentTurnPlayerId: data.nextTurnPlayerId ?? s.currentTurnPlayerId,
          currentRound: markQuestionPlayed(s.currentRound, s.currentQuestion?.id),
          skippedPlayers: null,
          timer: null,
        }),
        content: revealPlan
          ? {
              kind: "answer",
              plan: revealPlan,
              timer: localTimer(revealPlan.totalMs),
              frozenAtMs: null,
            }
          : null,
      };
    }

    case "answer-show-start":
      return patchState(session, { questionState: "showing_answer", answeringPlayer: null });

    case "answer-show-end":
      return backToChoosing(session);

    case "question-skip":
      return patchState(session, {
        skippedPlayers: [...new Set([...(s.skippedPlayers ?? []), event.payload.playerId])],
      });

    case "question-unskip":
      return patchState(session, {
        skippedPlayers: (s.skippedPlayers ?? []).filter((id) => id !== event.payload.playerId),
      });

    case "secret-question-picked":
      return patchState(session, {
        questionState: "secret_transfer",
        currentRound: markQuestionPlayed(s.currentRound, event.payload.questionId),
        secretQuestionData: {
          pickerPlayerId: event.payload.pickerPlayerId,
          transferType: event.payload.transferType,
          questionId: event.payload.questionId,
          transferDecisionPhase: true,
        },
        answeredPlayers: null,
        skippedPlayers: null,
        answeringPlayer: null,
        questionEligiblePlayers: event.payload.questionEligiblePlayers ?? null,
      });

    case "secret-question-transfer": {
      const { toPlayerId, allowedPrices, timer } = event.payload;
      if (allowedPrices?.length && s.secretQuestionData) {
        // customPrice: the receiver picks the price before the question shows.
        return patchState(session, {
          timer: timer ?? s.timer,
          secretQuestionData: {
            ...s.secretQuestionData,
            transferDecisionPhase: false,
            priceSelection: { playerId: toPlayerId, allowedPrices },
          },
        });
      }
      return patchState(session, {
        answeringPlayer: toPlayerId,
        secretQuestionData: s.secretQuestionData
          ? { ...s.secretQuestionData, transferDecisionPhase: false }
          : s.secretQuestionData,
      });
    }

    case "all-play-start": {
      const p = event.payload;
      const allPlay: AllPlayData = {
        mode: p.mode,
        questionId: p.questionId,
        price: p.price,
        maxStake: p.maxStake,
        priceMultiplier: p.priceMultiplier,
        entries: p.players.map((playerId) => ({
          playerId,
          stake: null,
          answer: null,
          submitted: false,
          isCorrect: null,
          scoreChange: null,
        })),
      };
      if (!p.timer) {
        // No-risk for everyone: the question follows with question-data.
        return patchState(session, { allPlay });
      }
      return {
        ...patchState(session, {
          questionState: "bidding",
          currentRound: markQuestionPlayed(s.currentRound, p.questionId),
          timer: p.timer,
          allPlay,
          answeredPlayers: null,
          skippedPlayers: null,
          answeringPlayer: null,
          answerShowData: null,
        }),
        content: null,
      };
    }

    case "all-play-stake":
    case "all-play-answer": {
      const staked = event.type === "all-play-stake";
      return patchAllPlayEntry(session, event.payload.playerId, (e) =>
        staked ? { ...e, stake: e.stake ?? 0 } : { ...e, submitted: true, answer: e.answer ?? "" },
      );
    }

    case "all-play-reviewing":
      return {
        ...patchState(session, {
          questionState: "reviewing",
          allPlay: event.payload.allPlay,
          timer: null,
        }),
        players: applyAllPlayScores(session.players, event.payload.allPlay),
      };

    case "all-play-review": {
      const { playerId, isCorrect, scoreChange, newScore } = event.payload;
      const next = patchAllPlayEntry(session, playerId, (e) => ({ ...e, isCorrect, scoreChange }));
      return {
        ...next,
        players: patchPlayer(next.players, playerId, (pl) => ({ ...pl, score: newScore })),
      };
    }

    case "question-toggle": {
      const { questionId, isPlayed } = event.payload;
      const round = s.currentRound;
      if (!round) return session;
      return patchState(session, {
        currentRound: {
          ...round,
          themes: round.themes.map((t) => ({
            ...t,
            questions: t.questions.map((q) => (q.id === questionId ? { ...q, isPlayed } : q)),
          })),
        },
      });
    }

    case "answer-result-undo": {
      const { playerId, newScore, canAnswerAgain } = event.payload;
      const answered = s.answeredPlayers ?? [];
      // The last ruling for this player is the one taken back.
      const at = answered.map((a) => a.player).lastIndexOf(playerId);
      const next = patchState(session, {
        answeredPlayers: canAnswerAgain && at >= 0 ? answered.filter((_, i) => i !== at) : answered,
        answerShowData: s.answerShowData
          ? { ...s.answerShowData, answerResult: undefined }
          : s.answerShowData,
      });
      return {
        ...next,
        players: patchPlayer(next.players, playerId, (p) => ({ ...p, score: newScore })),
        lastResult: null,
      };
    }

    case "game-join-mode":
      return patchState(session, {
        joinMode: event.payload.joinMode === "open" ? null : event.payload.joinMode,
      });

    case "secret-question-price":
      return patchState(session, {
        answeringPlayer: event.payload.playerId,
        secretQuestionData: s.secretQuestionData
          ? { ...s.secretQuestionData, priceSelection: null }
          : s.secretQuestionData,
      });

    case "stake-question-picked": {
      const p = event.payload;
      return patchState(session, {
        questionState: "bidding",
        currentRound: markQuestionPlayed(s.currentRound, p.questionId),
        timer: p.timer,
        answeredPlayers: null,
        skippedPlayers: null,
        answeringPlayer: null,
        questionEligiblePlayers: p.questionEligiblePlayers ?? null,
        currentTurnPlayerId: p.biddingOrder[0] ?? s.currentTurnPlayerId,
        stakeQuestionData: {
          pickerPlayerId: p.pickerPlayerId,
          questionId: p.questionId,
          maxPrice: p.maxPrice,
          bids: {},
          passedPlayers: [],
          biddingOrder: p.biddingOrder,
          currentBidderIndex: 0,
          highestBid: null,
          winnerPlayerId: null,
          biddingPhase: true,
        },
      });
    }

    case "stake-bid-submit": {
      const stake = s.stakeQuestionData;
      if (!stake) return session;
      const p = event.payload;
      const bids = { ...stake.bids, [String(p.playerId)]: p.bidAmount };
      const passed =
        p.bidType === "pass"
          ? [...new Set([...stake.passedPlayers, p.playerId])]
          : stake.passedPlayers;
      const highest =
        p.bidAmount != null &&
        p.bidType !== "pass" &&
        (stake.highestBid == null || p.bidAmount > stake.highestBid)
          ? p.bidAmount
          : stake.highestBid;
      const nextIndex =
        p.nextBidderId != null
          ? stake.biddingOrder.indexOf(p.nextBidderId)
          : stake.currentBidderIndex;
      return patchState(session, {
        timer: p.timer ?? s.timer,
        currentTurnPlayerId: p.nextBidderId ?? s.currentTurnPlayerId,
        stakeQuestionData: {
          ...stake,
          bids,
          passedPlayers: passed,
          highestBid: highest,
          currentBidderIndex: nextIndex < 0 ? stake.currentBidderIndex : nextIndex,
          biddingPhase: !p.isPhaseComplete,
          winnerPlayerId:
            p.isPhaseComplete && p.bidType !== "pass" ? p.playerId : stake.winnerPlayerId,
        },
      });
    }

    case "stake-question-winner": {
      const stake = s.stakeQuestionData;
      return patchState(session, {
        answeringPlayer: event.payload.winnerPlayerId,
        stakeQuestionData: stake
          ? {
              ...stake,
              winnerPlayerId: event.payload.winnerPlayerId,
              highestBid: event.payload.finalBid,
              biddingPhase: false,
            }
          : stake,
      });
    }

    case "theme-eliminate": {
      const final = s.finalRoundData;
      if (!final) return session;
      const next = patchFinal(session, {
        eliminatedThemes: [...new Set([...final.eliminatedThemes, event.payload.themeId])],
      });
      return patchState(next, { currentTurnPlayerId: event.payload.nextPlayerId });
    }

    case "final-phase-complete": {
      const { nextPhase, timer } = event.payload;
      const next = nextPhase ? patchFinal(session, { phase: nextPhase }) : session;
      return patchState(next, {
        questionState: nextPhase ?? s.questionState,
        timer: timer ?? null,
      });
    }

    case "final-bid-submit": {
      const final = s.finalRoundData;
      if (!final) return session;
      return patchFinal(session, {
        bids: { ...final.bids, [String(event.payload.playerId)]: event.payload.bidAmount },
      });
    }

    case "final-question-data": {
      const next = patchFinal(session, { questionData: event.payload.questionData });
      return patchState(next, { currentQuestion: event.payload.questionData.question });
    }

    case "final-answer-submit":
      return {
        ...session,
        finalSubmitted: [...new Set([...session.finalSubmitted, event.payload.playerId])],
      };

    case "final-auto-loss":
      return {
        ...session,
        finalSubmitted: [...new Set([...session.finalSubmitted, event.payload.playerId])],
        finalAutoLoss: { ...session.finalAutoLoss, [event.payload.playerId]: event.payload.reason },
      };

    case "final-submit-end": {
      const { nextPhase, allReviews } = event.payload;
      const final = s.finalRoundData;
      if (!final) return session;
      const answers = allReviews
        ? allReviews.map((r) => {
            const existing = final.answers.find((a) => a.id === r.answerId);
            return {
              id: r.answerId,
              playerId: r.playerId,
              answer: r.answerText,
              isCorrect: r.isCorrect,
              autoLoss: r.answerType === "auto_loss",
              submittedAt: existing?.submittedAt ?? new Date().toISOString(),
              reviewedAt:
                r.isCorrect == null ? null : (existing?.reviewedAt ?? new Date().toISOString()),
            };
          })
        : final.answers;
      const next = patchFinal(session, { phase: nextPhase ?? final.phase, answers });
      return patchState(next, { questionState: nextPhase ?? s.questionState, timer: null });
    }

    case "final-answer-review": {
      const final = s.finalRoundData;
      if (!final) return session;
      const { answerId, playerId, isCorrect, scoreChange } = event.payload;
      const next = patchFinal(session, {
        answers: final.answers.map((a) =>
          a.id === answerId ? { ...a, isCorrect, reviewedAt: new Date().toISOString() } : a,
        ),
      });
      return {
        ...next,
        players: patchPlayer(next.players, playerId, (p) => ({
          ...p,
          score: p.score + scoreChange,
        })),
      };
    }

    case "next-round": {
      const state = normalizeState(event.payload.gameState);
      return {
        ...session,
        state: { ...state, isPaused: state.isPaused ?? s.isPaused },
        submittedAnswer: null,
        finalSubmitted: [],
        finalAutoLoss: {},
        players: session.players.map((p) => ({ ...p, mediaDownloaded: false })),
      };
    }

    case "game-finished":
      return {
        ...patchState(session, { timer: null, answeringPlayer: null }),
        finished: true,
      };

    case "player-role-change":
      return { ...session, players: event.payload.players };

    case "player-slot-change":
      return { ...session, players: event.payload.players };

    case "score-changed":
      return {
        ...session,
        players: patchPlayer(session.players, event.payload.playerId, (p) => ({
          ...p,
          score: event.payload.newScore,
        })),
      };

    case "turn-player-changed":
      return patchState(session, { currentTurnPlayerId: event.payload.newTurnPlayerId });

    case "player-restricted": {
      const { playerId, muted, restricted, banned } = event.payload;
      return {
        ...session,
        players: patchPlayer(session.players, playerId, (p) => ({
          ...p,
          restrictionData: { muted, restricted, banned },
        })),
      };
    }

    case "chat-message":
      if (session.chat.some((m) => m.uuid === event.payload.uuid)) return session;
      return { ...session, chat: [...session.chat, event.payload].slice(-200) };

    default:
      return session;
  }
}

/** Stops the question timeline where it is (someone buzzed in). */
function freeze(content: ContentClock | null, paused: boolean): ContentClock | null {
  if (!content || content.kind !== "question" || content.frozenAtMs != null) return content;
  return {
    ...content,
    frozenAtMs: content.timer ? timerElapsed(content.timer, paused) : content.plan.totalMs,
  };
}

/** A pause/unpause re-sends the running timer; a frozen timeline stays put. */
function retime(content: ContentClock | null, timer: Timer | null): ContentClock | null {
  if (!content || content.frozenAtMs != null || !timer || !content.timer) return content;
  return { ...content, timer };
}

function patchAllPlayEntry(
  session: GameSession,
  playerId: number,
  patch: (entry: AllPlayEntry) => AllPlayEntry,
): GameSession {
  const allPlay = session.state.allPlay;
  if (!allPlay) return session;
  return patchState(session, {
    allPlay: {
      ...allPlay,
      entries: allPlay.entries.map((e) => (e.playerId === playerId ? patch(e) : e)),
    },
  });
}

/** Answers ruled automatically when the review starts (missing ones) change scores too. */
function applyAllPlayScores(players: Player[], allPlay: AllPlayData): Player[] {
  return allPlay.entries.reduce(
    (acc, e) =>
      e.scoreChange != null && e.isCorrect != null
        ? patchPlayer(acc, e.playerId, (p) => ({ ...p, score: p.score + (e.scoreChange ?? 0) }))
        : acc,
    players,
  );
}
