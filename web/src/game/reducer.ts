import type {
  AnsweredPlayer,
  ChatMessage,
  FinalRoundData,
  GameJoinData,
  GameState,
  Player,
  Question,
  Round,
  ServerEvent,
  Timer,
} from "./protocol";

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
}

export function sessionFromSnapshot(gameId: string, data: GameJoinData): GameSession {
  const state = normalizeState(data.gameState);
  const finalData = state.finalRoundData;
  return {
    gameId,
    title: data.meta.title,
    players: data.players,
    state,
    chat: data.chatMessages ?? [],
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
    }),
    submittedAnswer: null,
    players: session.players.map((p) => ({ ...p, mediaDownloaded: false })),
  };
}

function onQuestionData(
  session: GameSession,
  data: Question,
  timer: Timer,
  eligible?: number[] | null,
) {
  const s = session.state;
  const stake = s.stakeQuestionData;
  const secret = s.secretQuestionData;
  const newPick = s.questionState == null || s.questionState === "choosing";
  let questionState: GameState["questionState"] = s.questionState;
  let answeringPlayer = s.answeringPlayer;

  if (stake?.winnerPlayerId != null) {
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
    }),
    submittedAnswer: newPick ? null : session.submittedAnswer,
    players:
      newPick && questionState === "media_downloading"
        ? session.players.map((p) => ({ ...p, mediaDownloaded: false }))
        : session.players,
  };
}

/** Applies one server event. Pure: never mutates `session`. */
export function reduce(session: GameSession, event: ServerEvent): GameSession {
  const next = apply(session, event);
  return next === session ? session : { ...next, version: session.version + 1 };
}

function apply(session: GameSession, event: ServerEvent): GameSession {
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
      return patchState(session, {
        currentRound: event.payload.currentRound,
        questionState: "choosing",
        readyPlayers: null,
        currentTurnPlayerId:
          event.payload.currentTurnPlayerId !== undefined
            ? event.payload.currentTurnPlayerId
            : s.currentTurnPlayerId,
      });

    case "game-pause":
      return patchState(session, { isPaused: true, timer: event.payload.timer ?? s.timer });

    case "game-unpause":
      return patchState(session, { isPaused: false, timer: event.payload.timer ?? null });

    case "player-ready":
    case "player-unready":
      return patchState(session, { readyPlayers: event.payload.readyPlayers });

    case "media-download-status": {
      const { playerId, mediaDownloaded, allPlayersReady, timer } = event.payload;
      let players = session.players;
      if (allPlayersReady) {
        players = players.map((p) => (p.role === "player" ? { ...p, mediaDownloaded: true } : p));
      } else {
        players = patchPlayer(players, playerId, (p) => ({ ...p, mediaDownloaded }));
      }
      const next = { ...session, players };
      if (allPlayersReady && s.questionState === "media_downloading") {
        return patchState(next, { questionState: "showing", timer: timer ?? s.timer });
      }
      return next;
    }

    case "question-data":
      return onQuestionData(
        session,
        event.payload.data,
        event.payload.timer,
        event.payload.questionEligiblePlayers,
      );

    case "question-answer":
      return {
        ...patchState(session, {
          questionState: "answering",
          answeringPlayer: event.payload.userId,
          timer: event.payload.timer,
        }),
        submittedAnswer: null,
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
      };
    }

    case "question-finish": {
      const data = event.payload;
      // Final round: this reveals the correct answer after the review.
      if (s.currentRound?.type === "final") {
        return patchState(session, { answerShowData: data });
      }
      return patchState(session, {
        questionState: "showing_answer",
        answerShowData: data,
        answeringPlayer: null,
        currentTurnPlayerId: data.nextTurnPlayerId ?? s.currentTurnPlayerId,
        currentRound: markQuestionPlayed(s.currentRound, s.currentQuestion?.id),
        skippedPlayers: null,
        timer: null,
      });
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

    case "secret-question-transfer":
      return patchState(session, {
        answeringPlayer: event.payload.toPlayerId,
        secretQuestionData: s.secretQuestionData
          ? { ...s.secretQuestionData, transferDecisionPhase: false }
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
