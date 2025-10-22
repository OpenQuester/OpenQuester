export enum GameActionType {
  // Game Lifecycle
  JOIN = "join",
  LEAVE = "leave",
  START = "start",
  PAUSE = "pause",
  UNPAUSE = "unpause",
  NEXT_ROUND = "next-round",

  // Player Management
  PLAYER_READY = "player-ready",
  PLAYER_UNREADY = "player-unready",
  PLAYER_KICK = "player-kick",
  PLAYER_RESTRICTION = "player-restriction",
  PLAYER_ROLE_CHANGE = "player-role-change",
  PLAYER_SCORE_CHANGE = "player-score-change",
  PLAYER_SLOT_CHANGE = "player-slot-change",
  TURN_PLAYER_CHANGE = "turn-player-change",

  // Question Actions
  QUESTION_PICK = "question-pick",
  QUESTION_ANSWER = "question-answer",
  ANSWER_SUBMITTED = "answer-submitted",
  ANSWER_RESULT = "answer-result",
  QUESTION_SKIP = "question-skip",
  QUESTION_UNSKIP = "question-unskip",
  SKIP_QUESTION_FORCE = "skip-question-force",
  SECRET_QUESTION_TRANSFER = "secret-question-transfer",
  STAKE_BID_SUBMIT = "stake-bid-submit",

  // Final Round
  THEME_ELIMINATE = "theme-eliminate",
  FINAL_BID_SUBMIT = "final-bid-submit",
  FINAL_ANSWER_SUBMIT = "final-answer-submit",
  FINAL_ANSWER_REVIEW = "final-answer-review",

  // System
  DISCONNECT = "disconnect",
  CHAT_MESSAGE = "chat-message",
  MEDIA_DOWNLOADED = "media-downloaded",
}
