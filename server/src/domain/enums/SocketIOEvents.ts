export enum SocketIOEvents {
  ERROR = "error",
  DISCONNECT = "disconnect",
  CONNECTION = "connection",
  GAMES = "games",
  CHAT_MESSAGE = "chat-message",
}

export enum SocketIOUserEvents {
  USER_CHANGE = "user-change",
}

export enum SocketIOGameEvents {
  JOIN = "join",
  START = "start",
  LEAVE = "user-leave",
  GAME_DATA = "game-data",
  QUESTION_PICK = "question-pick",
  QUESTION_ANSWER = "question-answer",
  QUESTION_DATA = "question-data",
  QUESTION_FINISH = "question-finish",
  ANSWER_SUBMITTED = "answer-submitted",
  ANSWER_RESULT = "answer-result",
  NEXT_ROUND = "next-round",
  GAME_FINISHED = "game-finished",
  SKIP_QUESTION_FORCE = "skip-question-force",
  QUESTION_SKIP = "question-skip",
  QUESTION_UNSKIP = "question-unskip",
  GAME_PAUSE = "game-pause",
  GAME_UNPAUSE = "game-unpause",
  PLAYER_READY = "player-ready",
  PLAYER_UNREADY = "player-unready",

  // Final Round Events
  THEME_ELIMINATE = "theme-eliminate",
  FINAL_BID_SUBMIT = "final-bid-submit",
  FINAL_ANSWER_SUBMIT = "final-answer-submit",
  FINAL_ANSWER_REVIEW = "final-answer-review",
  FINAL_PHASE_COMPLETE = "final-phase-complete",
  FINAL_QUESTION_DATA = "final-question-data",
  FINAL_SUBMIT_END = "final-submit-end",
  FINAL_AUTO_LOSS = "final-auto-loss",
}
