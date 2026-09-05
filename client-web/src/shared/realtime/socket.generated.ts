// Generated from openapi/schema.json x-socket-io metadata. Do not edit.
import type { components } from "../api/schema";

export type GeneratedClientSocketPayloads = {
  join: components["schemas"]["SocketIOGameJoinInput"];
  "user-leave": undefined;
  start: undefined;
  "question-pick": components["schemas"]["SocketIOQuestionPickEventInput"];
  "question-answer": undefined;
  "answer-submitted": components["schemas"]["SocketIOAnswerSubmittedInput"];
  "answer-result": components["schemas"]["SocketIOAnswerResultInput"];
  "next-round": undefined;
  "skip-question-force": undefined;
  "skip-show-answer": undefined;
  "game-pause": undefined;
  "game-unpause": undefined;
  "theme-eliminate": components["schemas"]["SocketIOThemeEliminateInput"];
  "question-skip": undefined;
  "question-unskip": undefined;
  "player-ready": undefined;
  "player-unready": undefined;
  "player-kicked": components["schemas"]["SocketIOPlayerKickInput"];
  "player-restricted": components["schemas"]["SocketIOPlayerRestrictionInput"];
  "player-role-change": components["schemas"]["SocketIOPlayerRoleChangeInput"];
  "score-changed": components["schemas"]["SocketIOPlayerScoreChangeInput"];
  "player-slot-change": components["schemas"]["SocketIOPlayerSlotChangeInput"];
  "turn-player-changed": components["schemas"]["SocketIOTurnPlayerChangeInput"];
  "final-bid-submit": components["schemas"]["SocketIOFinalBidSubmitInput"];
  "final-answer-submit": components["schemas"]["SocketIOFinalAnswerSubmitInput"];
  "final-answer-review": components["schemas"]["SocketIOFinalAnswerReviewInput"];
  "secret-question-transfer": components["schemas"]["SocketIOSecretQuestionTransferInputData"];
  "stake-bid-submit": components["schemas"]["StakeBidSubmitInputData"];
  "media-downloaded": undefined;
  "chat-message": components["schemas"]["SocketIOChatMessageContent"];
  "question-guidance": components["schemas"]["SocketIOQuestionGuidanceEventPayload"];
};

export type GeneratedServerSocketPayloads = {
  join: components["schemas"]["SocketIOGameJoinReceivePayload"];
  "game-data": components["schemas"]["SocketIOGameJoinEventPayload"];
  start: components["schemas"]["SocketIOGameStartEventPayload"];
  "user-leave": components["schemas"]["SocketIOGameLeaveEventPayload"];
  "question-data": components["schemas"]["SocketIOQuestionDataEventPayload"];
  "question-answer": components["schemas"]["SocketIOQuestionAnswerEventPayload"];
  "question-finish": components["schemas"]["SocketIOQuestionFinishEventPayload"];
  "answer-submitted": components["schemas"]["SocketIOAnswerSubmittedInput"];
  "answer-result": components["schemas"]["SocketIOAnswerResultEventPayload"];
  "answer-show-start": components["schemas"]["SocketIOAnswerShowStartEventPayload"];
  "answer-show-end": components["schemas"]["SocketIOAnswerShowEndEventPayload"];
  "next-round": components["schemas"]["SocketIONextRoundEventPayload"];
  "game-finished": undefined;
  "game-pause": components["schemas"]["SocketIOGamePauseEventPayload"];
  "game-unpause": components["schemas"]["SocketIOGameUnpauseEventPayload"];
  "theme-eliminate": components["schemas"]["SocketIOThemeEliminatePayload"];
  "question-skip": components["schemas"]["SocketIOGameSkipEventPayload"];
  "question-unskip": components["schemas"]["SocketIOGameUnskipEventPayload"];
  "player-ready": components["schemas"]["SocketIOPlayerReadinessEventPayload"];
  "player-unready": components["schemas"]["SocketIOPlayerReadinessEventPayload"];
  "player-kicked": components["schemas"]["SocketIOPlayerKickEventPayload"];
  "player-restricted": components["schemas"]["SocketIOPlayerRestrictionEventPayload"];
  "player-role-change": components["schemas"]["SocketIOPlayerRoleChangeEventPayload"];
  "score-changed": components["schemas"]["SocketIOPlayerScoreChangeEventPayload"];
  "player-slot-change": components["schemas"]["SocketIOPlayerSlotChangeEventPayload"];
  "turn-player-changed": components["schemas"]["SocketIOTurnPlayerChangeEventPayload"];
  "final-bid-submit": components["schemas"]["SocketIOFinalBidSubmitPayload"];
  "final-answer-submit": components["schemas"]["SocketIOFinalAnswerSubmitPayload"];
  "final-answer-review": components["schemas"]["SocketIOFinalAnswerReviewPayload"];
  "final-phase-complete": components["schemas"]["SocketIOFinalPhaseCompletePayload"];
  "final-question-data": components["schemas"]["SocketIOFinalQuestionEventDataPayload"];
  "final-submit-end": components["schemas"]["SocketIOFinalSubmitEndPayload"];
  "final-auto-loss": components["schemas"]["SocketIOFinalAutoLossEventPayload"];
  "secret-question-picked": components["schemas"]["SocketIOSecretQuestionPickedEventPayload"];
  "secret-question-transfer": components["schemas"]["SocketIOSecretQuestionTransferEventPayload"];
  "stake-question-picked": components["schemas"]["SocketIOStakeQuestionPickedEventPayload"];
  "stake-bid-submit": components["schemas"]["StakeBidSubmitOutputData"];
  "stake-question-winner": components["schemas"]["SocketIOStakeQuestionWinnerEventPayload"];
  "media-download-status": components["schemas"]["MediaDownloadStatusEventPayload"];
  "chat-message": components["schemas"]["SocketIOChatMessageEventPayload"];
  "question-guidance": components["schemas"]["SocketIOQuestionGuidanceEventPayload"];
  notifications: components["schemas"]["SocketIONotificationEventPayload"];
  error: components["schemas"]["SocketIOErrorEventPayload"];
};

export const GENERATED_CLIENT_SOCKET_EVENTS = [
  "join",
  "user-leave",
  "start",
  "question-pick",
  "question-answer",
  "answer-submitted",
  "answer-result",
  "next-round",
  "skip-question-force",
  "skip-show-answer",
  "game-pause",
  "game-unpause",
  "theme-eliminate",
  "question-skip",
  "question-unskip",
  "player-ready",
  "player-unready",
  "player-kicked",
  "player-restricted",
  "player-role-change",
  "score-changed",
  "player-slot-change",
  "turn-player-changed",
  "final-bid-submit",
  "final-answer-submit",
  "final-answer-review",
  "secret-question-transfer",
  "stake-bid-submit",
  "media-downloaded",
  "chat-message",
  "question-guidance",
] as const;

export const GENERATED_SERVER_SOCKET_EVENTS = [
  "join",
  "game-data",
  "start",
  "user-leave",
  "question-data",
  "question-answer",
  "question-finish",
  "answer-submitted",
  "answer-result",
  "answer-show-start",
  "answer-show-end",
  "next-round",
  "game-finished",
  "game-pause",
  "game-unpause",
  "theme-eliminate",
  "question-skip",
  "question-unskip",
  "player-ready",
  "player-unready",
  "player-kicked",
  "player-restricted",
  "player-role-change",
  "score-changed",
  "player-slot-change",
  "turn-player-changed",
  "final-bid-submit",
  "final-answer-submit",
  "final-answer-review",
  "final-phase-complete",
  "final-question-data",
  "final-submit-end",
  "final-auto-loss",
  "secret-question-picked",
  "secret-question-transfer",
  "stake-question-picked",
  "stake-bid-submit",
  "stake-question-winner",
  "media-download-status",
  "chat-message",
  "question-guidance",
  "notifications",
  "error",
] as const;
