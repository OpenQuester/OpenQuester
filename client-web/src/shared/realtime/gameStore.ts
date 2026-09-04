import { produce } from "immer";
import { create } from "zustand";

import type { ChatMessage, GameState, JoinSnapshot, Player } from "./contracts";

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
  replaceSnapshot: (snapshot: JoinSnapshot) => void;
  applyEvent: (event: string, payload: unknown) => void;
  setConnection: (connection: ConnectionState) => void;
  setPending: (action: string | null) => void;
  setBuzzer: (state: BuzzerState) => void;
  reset: () => void;
};

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
};

function hasSnapshot(value: unknown): value is JoinSnapshot {
  return Boolean(
    value &&
    typeof value === "object" &&
    "gameState" in value &&
    "players" in value,
  );
}

export const useGameStore = create<GameStore>((set) => ({
  ...initial,
  replaceSnapshot: (snapshot) =>
    set({
      title: snapshot.meta.title,
      players: snapshot.players,
      gameState: snapshot.gameState,
      messages: [...snapshot.chatMessages].reverse(),
      pendingAction: null,
      finished: false,
      error: null,
      buzzer:
        snapshot.gameState.questionState === "answering" &&
        !snapshot.gameState.answeringPlayer
          ? "ready"
          : "locked",
    }),
  applyEvent: (event, payload) =>
    set(
      produce<GameStore>((draft) => {
        if (hasSnapshot(payload)) {
          draft.title = payload.meta.title;
          draft.players = payload.players;
          draft.gameState = payload.gameState;
          draft.messages = [...payload.chatMessages].reverse();
          draft.pendingAction = null;
          return;
        }
        const data = payload as Record<string, unknown> | undefined;
        const state = data?.gameState as GameState | undefined;
        if (state) draft.gameState = state;
        const players = data?.players as Player[] | undefined;
        if (players) draft.players = players;
        if (event === "chat-message")
          draft.messages.push(payload as ChatMessage);
        if (event === "join" && data?.meta && data?.role)
          draft.players.push(payload as Player);
        if (event === "user-leave" && typeof data?.user === "number")
          draft.players = draft.players.filter(
            (player) => player.meta.id !== data.user,
          );
        if (event === "start" && data?.currentRound) {
          draft.gameState ??= emptyGameState();
          draft.gameState.currentRound =
            data.currentRound as GameState["currentRound"];
          draft.gameState.questionState = "choosing";
        }
        if (event === "question-data" && data?.data) {
          draft.gameState ??= emptyGameState();
          draft.gameState.currentQuestion =
            data.data as GameState["currentQuestion"];
          draft.gameState.timer = (data.timer as GameState["timer"]) ?? null;
          draft.gameState.questionEligiblePlayers =
            (data.questionEligiblePlayers as number[]) ?? null;
          draft.gameState.questionState = "media_downloading";
          draft.gameState.answeringPlayer = null;
        }
        if (event === "question-answer" && typeof data?.userId === "number") {
          draft.gameState ??= emptyGameState();
          draft.gameState.answeringPlayer = data.userId;
          draft.gameState.questionState = "answering";
          draft.gameState.timer = (data.timer as GameState["timer"]) ?? null;
        }
        if (event === "answer-result" && data?.answerResult) {
          const result = data.answerResult as {
            player: number;
            score: number;
          };
          const player = draft.players.find(
            (item) => item.meta.id === result.player,
          );
          if (player) player.score = result.score;
          if (draft.gameState) {
            draft.gameState.answeredPlayers ??= [];
            draft.gameState.answeredPlayers.push(
              data.answerResult as NonNullable<
                GameState["answeredPlayers"]
              >[number],
            );
            draft.gameState.answeringPlayer = null;
            draft.gameState.timer = (data.timer as GameState["timer"]) ?? null;
          }
        }
        if (event === "question-skip" && draft.gameState) {
          const playerId = Number(data?.playerId);
          draft.gameState.skippedPlayers ??= [];
          if (!draft.gameState.skippedPlayers.includes(playerId))
            draft.gameState.skippedPlayers.push(playerId);
        }
        if (event === "question-unskip" && draft.gameState) {
          const playerId = Number(data?.playerId);
          draft.gameState.skippedPlayers =
            draft.gameState.skippedPlayers?.filter(
              (item) => item !== playerId,
            ) ?? null;
        }
        if (event === "question-finish" && draft.gameState) {
          draft.gameState.currentQuestion = null;
          draft.gameState.questionState = "showing_answer";
        }
        if (event === "answer-show-end" && draft.gameState) {
          draft.gameState.questionState = "choosing";
          draft.gameState.currentQuestion = null;
          draft.gameState.stakeQuestionData = null;
          draft.gameState.secretQuestionData = null;
        }
        if (event === "answer-show-start" && draft.gameState)
          draft.gameState.questionState = "showing_answer";
        if (event === "game-pause" && draft.gameState) {
          draft.gameState.isPaused = true;
          draft.gameState.timer = (data?.timer as GameState["timer"]) ?? null;
        }
        if (event === "game-unpause" && draft.gameState) {
          draft.gameState.isPaused = false;
          draft.gameState.timer = (data?.timer as GameState["timer"]) ?? null;
        }
        if (event === "player-ready" || event === "player-unready") {
          if (draft.gameState && Array.isArray(data?.readyPlayers))
            draft.gameState.readyPlayers = data.readyPlayers as number[];
        }
        if (event === "player-role-change" && Array.isArray(data?.players))
          draft.players = data.players as Player[];
        if (event === "score-changed" && typeof data?.playerId === "number") {
          const player = draft.players.find(
            (item) => item.meta.id === data.playerId,
          );
          if (player && typeof data.newScore === "number")
            player.score = data.newScore;
        }
        if (event === "turn-player-changed" && draft.gameState)
          draft.gameState.currentTurnPlayerId =
            typeof data?.newTurnPlayerId === "number"
              ? data.newTurnPlayerId
              : null;
        if (event === "secret-question-picked") {
          draft.gameState ??= emptyGameState();
          draft.gameState.questionState = "secret_transfer";
          draft.gameState.questionEligiblePlayers =
            (data?.questionEligiblePlayers as number[]) ?? null;
          draft.gameState.secretQuestionData = {
            pickerPlayerId: Number(data?.pickerPlayerId),
            questionId: Number(data?.questionId),
            transferType: data?.transferType as NonNullable<
              GameState["secretQuestionData"]
            >["transferType"],
            transferDecisionPhase: true,
          };
        }
        if (event === "secret-question-transfer" && draft.gameState) {
          if (draft.gameState.secretQuestionData)
            draft.gameState.secretQuestionData.transferDecisionPhase = false;
          if (typeof data?.toPlayerId === "number") {
            draft.gameState.questionEligiblePlayers = [data.toPlayerId];
            draft.gameState.answeringPlayer = data.toPlayerId;
          }
        }
        if (event === "stake-question-picked") {
          draft.gameState ??= emptyGameState();
          const biddingOrder = (data?.biddingOrder as number[]) ?? [];
          draft.gameState.questionState = "bidding";
          draft.gameState.timer = (data?.timer as GameState["timer"]) ?? null;
          draft.gameState.questionEligiblePlayers =
            (data?.questionEligiblePlayers as number[]) ?? null;
          draft.gameState.stakeQuestionData = {
            pickerPlayerId: Number(data?.pickerPlayerId),
            questionId: Number(data?.questionId),
            maxPrice: typeof data?.maxPrice === "number" ? data.maxPrice : null,
            bids: {},
            passedPlayers: [],
            biddingOrder,
            currentBidderIndex: 0,
            highestBid: null,
            winnerPlayerId: null,
            biddingPhase: true,
          };
        }
        if (
          event === "stake-bid-submit" &&
          draft.gameState?.stakeQuestionData
        ) {
          const stake = draft.gameState.stakeQuestionData;
          const playerId = Number(data?.playerId);
          const bidAmount =
            typeof data?.bidAmount === "number" ? data.bidAmount : null;
          stake.bids[String(playerId)] = bidAmount;
          if (
            data?.bidType === "pass" &&
            !stake.passedPlayers.includes(playerId)
          )
            stake.passedPlayers.push(playerId);
          if (
            bidAmount !== null &&
            (stake.highestBid === null || bidAmount > stake.highestBid)
          ) {
            stake.highestBid = bidAmount;
            stake.winnerPlayerId = playerId;
          }
          const nextIndex = stake.biddingOrder.indexOf(
            Number(data?.nextBidderId),
          );
          if (nextIndex >= 0) stake.currentBidderIndex = nextIndex;
          stake.biddingPhase = data?.isPhaseComplete !== true;
          draft.gameState.timer = (data?.timer as GameState["timer"]) ?? null;
        }
        if (
          event === "stake-question-winner" &&
          draft.gameState?.stakeQuestionData
        ) {
          draft.gameState.stakeQuestionData.winnerPlayerId = Number(
            data?.winnerPlayerId,
          );
          draft.gameState.stakeQuestionData.highestBid =
            typeof data?.finalBid === "number" ? data.finalBid : null;
          draft.gameState.stakeQuestionData.biddingPhase = false;
        }
        if (event === "theme-eliminate" && draft.gameState) {
          const final = draft.gameState.finalRoundData;
          if (final && typeof data?.themeId === "number")
            final.eliminatedThemes.push(data.themeId);
          draft.gameState.currentTurnPlayerId =
            typeof data?.nextPlayerId === "number" ? data.nextPlayerId : null;
        }
        if (event === "final-phase-complete" && draft.gameState) {
          if (draft.gameState.finalRoundData)
            draft.gameState.finalRoundData.phase =
              data?.nextPhase as NonNullable<
                GameState["finalRoundData"]
              >["phase"];
          draft.gameState.questionState =
            data?.nextPhase as GameState["questionState"];
          draft.gameState.timer = (data?.timer as GameState["timer"]) ?? null;
        }
        if (event === "final-question-data" && draft.gameState?.finalRoundData)
          draft.gameState.finalRoundData.questionData =
            data?.questionData as NonNullable<
              GameState["finalRoundData"]
            >["questionData"];
        if (event === "final-bid-submit" && draft.gameState?.finalRoundData) {
          const playerId = Number(data?.playerId);
          if (typeof data?.bidAmount === "number")
            draft.gameState.finalRoundData.bids[String(playerId)] =
              data.bidAmount;
        }
        if (event === "final-submit-end" && draft.gameState?.finalRoundData) {
          if (data?.nextPhase)
            draft.gameState.finalRoundData.phase =
              data.nextPhase as NonNullable<
                GameState["finalRoundData"]
              >["phase"];
          if (Array.isArray(data?.allReviews))
            draft.gameState.finalRoundData.answers = data.allReviews.map(
              (review) => {
                const item = review as Record<string, unknown>;
                return {
                  id: String(item.answerId),
                  playerId: Number(item.playerId),
                  answer:
                    typeof item.answerText === "string" ? item.answerText : "",
                  isCorrect:
                    typeof item.isCorrect === "boolean" ? item.isCorrect : null,
                  autoLoss: item.answerType === "auto_loss",
                  submittedAt: new Date().toISOString(),
                  reviewedAt: null,
                };
              },
            );
        }
        if (
          event === "final-answer-review" &&
          draft.gameState?.finalRoundData
        ) {
          const answer = draft.gameState.finalRoundData.answers.find(
            (item) => item.id === data?.answerId,
          );
          if (answer) {
            answer.isCorrect = data?.isCorrect === true;
            answer.reviewedAt = new Date().toISOString();
          }
        }
        if (event === "question-guidance")
          draft.guidance =
            typeof data?.message === "string" ? data.message : "";
        if (event === "error")
          draft.error =
            typeof data?.message === "string" ? data.message : "Socket error";
        if (event === "question-answer") draft.buzzer = "accepted";
        if (event === "question-data") draft.buzzer = "locked";
        if (event === "media-download-status" && data?.allPlayersReady) {
          draft.buzzer = "ready";
          if (draft.gameState) {
            draft.gameState.questionState = "showing";
            draft.gameState.timer = (data.timer as GameState["timer"]) ?? null;
          }
        }
        if (event === "game-finished") draft.finished = true;
        if (event === "answer-result" || event === "question-finish")
          draft.buzzer = "locked";
        draft.pendingAction = null;
      }),
    ),
  setConnection: (connection) => set({ connection }),
  setPending: (pendingAction) => set({ pendingAction }),
  setBuzzer: (buzzer) => set({ buzzer }),
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
