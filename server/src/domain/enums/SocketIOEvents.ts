export enum SocketIOEvents {
  ERROR = "error",
  DISCONNECT = "disconnect",
  CONNECTION = "connection",
  GAMES = "games",
  CHAT_MESSAGE = "chat-message",
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
  GAME_PAUSE = "game-pause",
  GAME_UNPAUSE = "game-unpause",
}
