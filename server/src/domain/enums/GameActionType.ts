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
  BUZZER_OPEN = "buzzer-open",
  ANSWER_SUBMITTED = "answer-submitted",
  ANSWER_RESULT = "answer-result",
  QUESTION_SKIP = "question-skip",
  QUESTION_UNSKIP = "question-unskip",
  SKIP_QUESTION_FORCE = "skip-question-force",
  SKIP_SHOW_ANSWER = "skip-show-answer",
  SECRET_QUESTION_TRANSFER = "secret-question-transfer",
  /**
   * The player who got a secret question picks its cost from the allowed
   * prices (SIGame "cat in a bag" with a choosable price). It is the
   * question's price, not a bet: a right answer gains it, a wrong one loses it.
   */
  SECRET_QUESTION_PRICE = "secret-question-price",
  ALL_PLAY_STAKE = "all-play-stake",
  /** Showman takes a question off the board, or puts a removed one back. */
  QUESTION_REMOVE_RESTORE = "question-remove-restore",
  /**
   * Showman takes back their last ruling on the current question (a misclick
   * on right/wrong): the points are returned and that player may answer again.
   */
  ANSWER_RESULT_UNDO = "answer-result-undo",
  /** Showman changes who can join the game: everyone, spectators only, nobody new. */
  GAME_JOIN_MODE_CHANGE = "game-join-mode-change",
  ALL_PLAY_ANSWER = "all-play-answer",
  ALL_PLAY_REVIEW = "all-play-review",
  STAKE_BID_SUBMIT = "stake-bid-submit",

  // Final Round
  THEME_ELIMINATE = "theme-eliminate",
  FINAL_BID_SUBMIT = "final-bid-submit",
  FINAL_ANSWER_SUBMIT = "final-answer-submit",
  FINAL_ANSWER_REVIEW = "final-answer-review",

  // Moderation (admin panel; never mapped to a socket event)
  ADMIN_GAME_CLOSE = "admin-game-close",

  // System
  DISCONNECT = "disconnect",
  CHAT_MESSAGE = "chat-message",
  MEDIA_DOWNLOADED = "media-downloaded",

  // Timer Expirations
  TIMER_MEDIA_DOWNLOAD_EXPIRED = "timer-media-download-expired",
  TIMER_QUESTION_SHOWING_EXPIRED = "timer-question-showing-expired",
  TIMER_QUESTION_ANSWERING_EXPIRED = "timer-question-answering-expired",
  TIMER_THEME_ELIMINATION_EXPIRED = "timer-theme-elimination-expired",
  TIMER_BIDDING_EXPIRED = "timer-bidding-expired",
  TIMER_FINAL_ANSWERING_EXPIRED = "timer-final-answering-expired",
}
