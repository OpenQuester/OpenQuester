import { produce, type WritableDraft } from "immer";
import { create } from "zustand";

import type {
  ChatMessage,
  GameState,
  JoinSnapshot,
  Player,
  ServerEvent,
  ServerPayload,
} from "./contracts";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";
export type BuzzerState =
  | "locked"
  | "ready"
  | "pending"
  | "accepted"
  | "missed"
  | "already-answered"
  | "skipped"
  | "ineligible"
  | "spectator";

export type GameNotification = {
  type: "game-expiration-warning";
  expiresAt: string;
};

type GameStore = {
  connection: ConnectionState;
  title: string;
  players: Player[];
  gameState: GameState | null;
  messages: ChatMessage[];
  guidance: string | null;
  error: string | null;
  buzzer: BuzzerState;
  pendingAction: string | null;
  finished: boolean;
  /** Set when this client's own player was removed from the room. */
  removedFromGame: "kicked" | "banned" | null;
  notification: GameNotification | null;
  replaceSnapshot: (snapshot: JoinSnapshot) => void;
  /**
   * Payloads arrive from socket.io as `unknown`. Per-event typing lives in the
   * `handlers` map below, where each body is checked against its generated
   * payload; this signature is only the untyped transport boundary.
   */
  applyEvent: (event: ServerEvent, payload: unknown) => void;
  setConnection: (connection: ConnectionState) => void;
  setPending: (action: string | null) => void;
  setBuzzer: (state: BuzzerState) => void;
  setSelfId: (userId: number | undefined) => void;
  dismissNotification: () => void;
  reset: () => void;
};

/** What a handler mutates: the immer draft, not the frozen store value. */
type GameDraft = WritableDraft<GameStore>;

/** Cap on retained chat history, so a long game cannot grow without bound. */
const MAX_MESSAGES = 300;

const initial = {
  connection: "idle" as const,
  title: "",
  players: [] as Player[],
  gameState: null as GameState | null,
  messages: [] as ChatMessage[],
  guidance: null as string | null,
  error: null as string | null,
  buzzer: "locked" as BuzzerState,
  pendingAction: null as string | null,
  finished: false,
  removedFromGame: null as "kicked" | "banned" | null,
  notification: null as GameNotification | null,
};

/**
 * The id of the local user, so events that name a player can tell whether they
 * are about this client. Kept outside React state because handlers run inside
 * the immer producer.
 */
let selfId: number | undefined;

function hasSnapshot(value: unknown): value is JoinSnapshot {
  return Boolean(
    value &&
    typeof value === "object" &&
    "gameState" in value &&
    "players" in value,
  );
}

function applySnapshot(draft: GameDraft, snapshot: JoinSnapshot) {
  draft.title = snapshot.meta.title;
  draft.players = snapshot.players;
  draft.gameState = snapshot.gameState;
  draft.messages = [...snapshot.chatMessages].reverse().slice(-MAX_MESSAGES);
  draft.pendingAction = null;
  draft.finished = false;
  draft.error = null;
  draft.removedFromGame = null;
  draft.buzzer =
    snapshot.gameState.questionState === "answering" &&
    !snapshot.gameState.answeringPlayer
      ? "ready"
      : "locked";
}

function findPlayer(draft: GameDraft, playerId: number) {
  return draft.players.find((player) => player.meta.id === playerId);
}

/**
 * One handler per server event, each typed against the generated payload for
 * that event. A missing key is a deliberate no-op; a wrong field name is a
 * compile error rather than a silent runtime miss.
 */
type EventHandlers = {
  [Event in ServerEvent]?: (
    draft: GameDraft,
    payload: ServerPayload<Event>,
  ) => void;
};

const handlers: EventHandlers = {
  join: (draft, payload) => {
    if (hasSnapshot(payload)) {
      applySnapshot(draft, payload);
      return;
    }
    const player = payload;
    const existing = findPlayer(draft, player.meta.id);
    if (existing) Object.assign(existing, player);
    else draft.players.push(player);
  },

  "game-data": (draft, payload) => applySnapshot(draft, payload),

  start: (draft, payload) => {
    draft.gameState ??= emptyGameState();
    draft.gameState.currentRound = payload.currentRound;
    draft.gameState.questionState = "choosing";
  },

  "next-round": (draft, payload) => {
    draft.gameState = payload.gameState;
    draft.buzzer = "locked";
  },

  "user-leave": (draft, payload) => {
    draft.players = draft.players.filter(
      (player) => player.meta.id !== payload.user,
    );
  },

  "question-data": (draft, payload) => {
    draft.gameState ??= emptyGameState();
    draft.gameState.currentQuestion = payload.data;
    draft.gameState.timer = payload.timer ?? null;
    draft.gameState.questionEligiblePlayers =
      payload.questionEligiblePlayers ?? null;
    draft.gameState.questionState = "media_downloading";
    draft.gameState.answeringPlayer = null;
    draft.buzzer = "locked";
    for (const player of draft.players) player.mediaDownloaded = false;
  },

  "question-answer": (draft, payload) => {
    draft.gameState ??= emptyGameState();
    draft.gameState.answeringPlayer = payload.userId;
    draft.gameState.questionState = "answering";
    draft.gameState.timer = payload.timer ?? null;
    draft.buzzer = "accepted";
  },

  "answer-result": (draft, payload) => {
    const result = payload.answerResult;
    if (!result) return;
    const player = findPlayer(draft, result.player);
    if (player) player.score = result.score;
    if (draft.gameState) {
      draft.gameState.answeredPlayers ??= [];
      draft.gameState.answeredPlayers.push(result);
      draft.gameState.answeringPlayer = null;
      draft.gameState.timer = payload.timer ?? null;
    }
    draft.buzzer = "locked";
  },

  "question-skip": (draft, payload) => {
    if (!draft.gameState) return;
    draft.gameState.skippedPlayers ??= [];
    if (!draft.gameState.skippedPlayers.includes(payload.playerId))
      draft.gameState.skippedPlayers.push(payload.playerId);
  },

  "question-unskip": (draft, payload) => {
    if (!draft.gameState) return;
    draft.gameState.skippedPlayers =
      draft.gameState.skippedPlayers?.filter(
        (item) => item !== payload.playerId,
      ) ?? null;
  },

  "question-finish": (draft) => {
    if (!draft.gameState) return;
    draft.gameState.currentQuestion = null;
    draft.gameState.questionState = "showing_answer";
    draft.buzzer = "locked";
  },

  "answer-show-start": (draft) => {
    if (draft.gameState) draft.gameState.questionState = "showing_answer";
  },

  "answer-show-end": (draft) => {
    if (!draft.gameState) return;
    draft.gameState.questionState = "choosing";
    draft.gameState.currentQuestion = null;
    draft.gameState.stakeQuestionData = null;
    draft.gameState.secretQuestionData = null;
  },

  "game-pause": (draft, payload) => {
    if (!draft.gameState) return;
    draft.gameState.isPaused = true;
    draft.gameState.timer = payload.timer ?? null;
  },

  "game-unpause": (draft, payload) => {
    if (!draft.gameState) return;
    draft.gameState.isPaused = false;
    draft.gameState.timer = payload.timer ?? null;
  },

  "player-ready": (draft, payload) => {
    if (draft.gameState) draft.gameState.readyPlayers = payload.readyPlayers;
  },

  "player-unready": (draft, payload) => {
    if (draft.gameState) draft.gameState.readyPlayers = payload.readyPlayers;
  },

  "player-role-change": (draft, payload) => {
    draft.players = payload.players;
  },

  "player-slot-change": (draft, payload) => {
    draft.players = payload.players;
  },

  "player-kicked": (draft, payload) => {
    draft.players = draft.players.filter(
      (player) => player.meta.id !== payload.playerId,
    );
    if (payload.playerId === selfId) draft.removedFromGame = "kicked";
  },

  "player-restricted": (draft, payload) => {
    const player = findPlayer(draft, payload.playerId);
    if (player)
      player.restrictionData = {
        muted: payload.muted,
        restricted: payload.restricted,
        banned: payload.banned,
      };
    if (payload.playerId === selfId && payload.banned)
      draft.removedFromGame = "banned";
  },

  "score-changed": (draft, payload) => {
    const player = findPlayer(draft, payload.playerId);
    if (player) player.score = payload.newScore;
  },

  "turn-player-changed": (draft, payload) => {
    if (draft.gameState)
      draft.gameState.currentTurnPlayerId = payload.newTurnPlayerId ?? null;
  },

  "secret-question-picked": (draft, payload) => {
    draft.gameState ??= emptyGameState();
    draft.gameState.questionState = "secret_transfer";
    draft.gameState.questionEligiblePlayers =
      payload.questionEligiblePlayers ?? null;
    draft.gameState.secretQuestionData = {
      pickerPlayerId: payload.pickerPlayerId,
      questionId: payload.questionId,
      transferType: payload.transferType,
      transferDecisionPhase: true,
    };
  },

  "secret-question-transfer": (draft, payload) => {
    if (!draft.gameState) return;
    if (draft.gameState.secretQuestionData)
      draft.gameState.secretQuestionData.transferDecisionPhase = false;
    draft.gameState.questionEligiblePlayers = [payload.toPlayerId];
    draft.gameState.answeringPlayer = payload.toPlayerId;
  },

  "stake-question-picked": (draft, payload) => {
    draft.gameState ??= emptyGameState();
    draft.gameState.questionState = "bidding";
    draft.gameState.timer = payload.timer ?? null;
    draft.gameState.questionEligiblePlayers =
      payload.questionEligiblePlayers ?? null;
    draft.gameState.stakeQuestionData = {
      pickerPlayerId: payload.pickerPlayerId,
      questionId: payload.questionId,
      maxPrice: payload.maxPrice ?? null,
      bids: {},
      passedPlayers: [],
      biddingOrder: payload.biddingOrder ?? [],
      currentBidderIndex: 0,
      highestBid: null,
      winnerPlayerId: null,
      biddingPhase: true,
    };
  },

  "stake-bid-submit": (draft, payload) => {
    const stake = draft.gameState?.stakeQuestionData;
    if (!stake || !draft.gameState) return;
    stake.bids[String(payload.playerId)] = payload.bidAmount ?? null;
    if (
      payload.bidType === "pass" &&
      !stake.passedPlayers.includes(payload.playerId)
    )
      stake.passedPlayers.push(payload.playerId);
    if (
      payload.bidAmount != null &&
      (stake.highestBid === null || payload.bidAmount > stake.highestBid)
    ) {
      stake.highestBid = payload.bidAmount;
      stake.winnerPlayerId = payload.playerId;
    }
    const nextIndex = stake.biddingOrder.indexOf(payload.nextBidderId ?? -1);
    if (nextIndex >= 0) stake.currentBidderIndex = nextIndex;
    stake.biddingPhase = payload.isPhaseComplete !== true;
    draft.gameState.timer = payload.timer ?? null;
  },

  "stake-question-winner": (draft, payload) => {
    const stake = draft.gameState?.stakeQuestionData;
    if (!stake) return;
    stake.winnerPlayerId = payload.winnerPlayerId;
    stake.highestBid = payload.finalBid ?? null;
    stake.biddingPhase = false;
  },

  "theme-eliminate": (draft, payload) => {
    if (!draft.gameState) return;
    const final = draft.gameState.finalRoundData;
    if (final && !final.eliminatedThemes.includes(payload.themeId))
      final.eliminatedThemes.push(payload.themeId);
    draft.gameState.currentTurnPlayerId = payload.nextPlayerId ?? null;
  },

  "final-phase-complete": (draft, payload) => {
    if (!draft.gameState) return;
    if (draft.gameState.finalRoundData)
      draft.gameState.finalRoundData.phase = payload.nextPhase;
    draft.gameState.questionState = payload.nextPhase;
    draft.gameState.timer = payload.timer ?? null;
  },

  "final-question-data": (draft, payload) => {
    if (draft.gameState?.finalRoundData)
      draft.gameState.finalRoundData.questionData = payload.questionData;
  },

  "final-bid-submit": (draft, payload) => {
    const final = draft.gameState?.finalRoundData;
    if (final) final.bids[String(payload.playerId)] = payload.bidAmount;
  },

  "final-submit-end": (draft, payload) => {
    const final = draft.gameState?.finalRoundData;
    if (!final) return;
    if (payload.nextPhase) final.phase = payload.nextPhase;
    if (Array.isArray(payload.allReviews))
      final.answers = payload.allReviews.map((review) => ({
        id: String(review.answerId),
        playerId: review.playerId,
        answer: review.answerText ?? "",
        isCorrect:
          typeof review.isCorrect === "boolean" ? review.isCorrect : null,
        autoLoss: review.answerType === "auto_loss",
        submittedAt: new Date().toISOString(),
        reviewedAt: null,
      }));
  },

  "final-answer-review": (draft, payload) => {
    const answer = draft.gameState?.finalRoundData?.answers.find(
      (item) => item.id === payload.answerId,
    );
    if (!answer) return;
    answer.isCorrect = payload.isCorrect;
    answer.reviewedAt = new Date().toISOString();
  },

  "media-download-status": (draft, payload) => {
    const player = findPlayer(draft, payload.playerId);
    if (player) player.mediaDownloaded = payload.mediaDownloaded;
    if (!payload.allPlayersReady) return;
    draft.buzzer = "ready";
    if (draft.gameState) {
      draft.gameState.questionState = "showing";
      draft.gameState.timer = payload.timer ?? null;
    }
  },

  "chat-message": (draft, payload) => {
    draft.messages.push(payload);
    if (draft.messages.length > MAX_MESSAGES)
      draft.messages.splice(0, draft.messages.length - MAX_MESSAGES);
  },

  "question-guidance": (draft, payload) => {
    draft.guidance = payload.message;
  },

  notifications: (draft, payload) => {
    if (payload.type === "game-expiration-warning")
      draft.notification = {
        type: payload.type,
        expiresAt: payload.data.expiresAt,
      };
  },

  "game-finished": (draft) => {
    draft.finished = true;
  },

  error: (draft, payload) => {
    draft.error = payload.message || "Socket error";
  },
};

/**
 * Events whose arrival means the action this client was waiting on has been
 * resolved. Unrelated events must not clear it, or a button unlocks early.
 */
const RESOLVING_EVENTS = new Set<ServerEvent>([
  "join",
  "game-data",
  "start",
  "next-round",
  "question-data",
  "question-answer",
  "question-finish",
  "answer-result",
  "answer-show-start",
  "answer-show-end",
  "question-skip",
  "question-unskip",
  "player-ready",
  "player-unready",
  "player-role-change",
  "player-slot-change",
  "score-changed",
  "theme-eliminate",
  "stake-bid-submit",
  "final-bid-submit",
  "final-answer-submit",
  "final-answer-review",
  "secret-question-transfer",
  "game-pause",
  "game-unpause",
  "error",
]);

export const useGameStore = create<GameStore>((set) => ({
  ...initial,
  replaceSnapshot: (snapshot) =>
    set(produce<GameStore>((draft) => applySnapshot(draft, snapshot))),
  applyEvent: (event, payload) =>
    set(
      produce<GameStore>((draft) => {
        // The only cast in the reducer, and it is confined to this dispatch:
        // socket.io hands payloads in as unknown, while each handler body is
        // typed against its own generated payload.
        const handler = handlers[event] as unknown as
          ((draft: GameDraft, payload: unknown) => void) | undefined;
        handler?.(draft, payload);
        if (RESOLVING_EVENTS.has(event)) draft.pendingAction = null;
      }),
    ),
  setConnection: (connection) => set({ connection }),
  setPending: (pendingAction) => set({ pendingAction }),
  setBuzzer: (buzzer) => set({ buzzer }),
  setSelfId: (userId) => {
    selfId = userId;
  },
  dismissNotification: () => set({ notification: null }),
  reset: () => set(initial),
}));

function emptyGameState(): GameState {
  return {
    questionState: null,
    isPaused: false,
    currentRound: null,
    currentQuestion: null,
    answeringPlayer: null,
    answeredPlayers: null,
    skippedPlayers: null,
    readyPlayers: null,
    timer: null,
  };
}

export function getTimerRemaining(timer: GameState["timer"], now = Date.now()) {
  if (!timer) return 0;
  const anchor = timer.resumedAt
    ? Date.parse(timer.resumedAt)
    : Date.parse(timer.startedAt);
  const elapsedBeforeAnchor = timer.resumedAt ? timer.elapsedMs : 0;
  return Math.max(
    0,
    timer.durationMs - elapsedBeforeAnchor - Math.max(0, now - anchor),
  );
}

export function getRole(players: Player[], userId?: number) {
  return (
    players.find((player) => player.meta.id === userId)?.role ?? "spectator"
  );
}

export function reconcileBuzzer(input: {
  current: BuzzerState;
  role: string;
  userId?: number;
  phase: string;
  state: GameState | null;
}): BuzzerState {
  const { current, role, userId, phase, state } = input;
  if (role === "spectator") return "spectator";
  if (!userId) return "ineligible";
  if (state?.skippedPlayers?.includes(userId)) return "skipped";
  if (state?.answeredPlayers?.some((item) => item.player === userId))
    return "already-answered";
  if (
    state?.questionEligiblePlayers &&
    !state.questionEligiblePlayers.includes(userId)
  )
    return "ineligible";
  if (state?.answeringPlayer)
    return state.answeringPlayer === userId ? "accepted" : "missed";
  if (phase === "buzzer") return current === "pending" ? "pending" : "ready";
  return "locked";
}
