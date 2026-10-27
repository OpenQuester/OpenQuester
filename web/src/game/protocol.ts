/**
 * Socket.IO game protocol for the /games namespace.
 *
 * These types mirror the server's runtime DTOs (server/src/domain/types/**),
 * which are the source of truth. openapi/schema.json lags behind in a few
 * places (for example `questionState` is missing `media_downloading`,
 * `showing_answer` and `secret_transfer`, and `answerShowData` is absent), so
 * the web client keeps its own precise copy here.
 */

export type PlayerRole = "showman" | "player" | "spectator";
export type PlayerStatus = "in-game" | "disconnected";

export type QuestionState =
  | "choosing"
  | "media_downloading"
  | "theme_elimination"
  | "bidding"
  | "answering"
  | "reviewing"
  | "showing"
  | "showing_answer"
  | "secret_transfer";

export type QuestionType = "simple" | "stake" | "secret" | "noRisk" | "hidden" | "choice";
export type FileType = "image" | "audio" | "video";
export type RoundType = "simple" | "final";
export type FinalPhase = "theme_elimination" | "bidding" | "answering" | "reviewing";
export type AnswerResultType = "correct" | "wrong" | "skip";
export type FinalAnswerType = "correct" | "wrong" | "auto_loss" | "pending";
export type StakeBidType = "normal" | "pass" | "all-in";
export type TransferType = "any" | "exceptCurrent";

/** Server-side "system" actor id used for timeouts and automatic actions. */
export const SYSTEM_PLAYER_ID = -1;

export interface Timer {
  startedAt: string;
  durationMs: number;
  elapsedMs: number;
  resumedAt?: string | null;
}

export interface PlayerMeta {
  id: number;
  avatar: string | null;
  username: string;
}

export interface Player {
  meta: PlayerMeta;
  slot: number | null;
  role: PlayerRole;
  status: PlayerStatus;
  restrictionData: { muted: boolean; restricted: boolean; banned: boolean };
  score: number;
  mediaDownloaded?: boolean;
}

export interface BoardQuestion {
  id: number;
  order: number;
  price: number | null;
  questionComment?: string | null;
  isPlayed: boolean;
}

export interface BoardTheme {
  id: number;
  order: number;
  name: string;
  description?: string | null;
  questions: BoardQuestion[];
}

export interface Round {
  id?: number;
  order: number;
  name: string;
  description?: string | null;
  type: RoundType;
  themes: BoardTheme[];
}

export interface PackageFile {
  id?: number;
  md5: string;
  type: FileType;
  link?: string | null;
}

export type ContentPlacement = "screen" | "background";

export interface QuestionFile {
  file: PackageFile;
  displayTime: number | null;
  order: number;
  /** Defaults to screen. Background is audio that plays under the stage. */
  placement?: ContentPlacement;
  /** When false, the next item is shown together with this one. Defaults to true. */
  waitForFinish?: boolean;
}

export interface ContentPlanItem {
  kind: "text" | "file";
  /** File order for file items; the question's textOrder for the text item. */
  order: number;
  placement: ContentPlacement;
  durationMs: number;
}

export interface ContentStep {
  startMs: number;
  durationMs: number;
  items: ContentPlanItem[];
}

/**
 * Server-timed content timeline. The position on it is the phase timer's
 * elapsed time, so every client shows the same step, also after a pause, an
 * answer or a reconnect.
 */
export interface ContentPlan {
  steps: ContentStep[];
  totalMs: number;
}

export interface ChoiceAnswer {
  id?: number;
  text?: string | null;
  file: PackageFile | null;
  order: number;
}

export interface Question {
  id?: number;
  type: QuestionType;
  order: number;
  price: number | null;
  isHidden: boolean;
  text?: string | null;
  /** Position of the text in the content order; null keeps it as a caption. */
  textOrder?: number | null;
  /** Showman only. */
  answerHint?: string | null;
  /** How the answer is given: typed/said, a number, or a spot on the picture. */
  answerType?: "text" | "number" | "point" | null;
  /** Showman only: the right number / spot, and how far off still counts. */
  answerNumber?: number | null;
  answerPoint?: { x: number; y: number; imageAspectRatio?: number } | null;
  answerDeviation?: number | null;
  /** Showman only: other right answers and known wrong answers. */
  rightAnswers?: string[] | null;
  wrongAnswers?: string[] | null;
  /** Showman only until the answer is revealed. */
  answerText?: string | null;
  answerDelay: number;
  questionComment?: string | null;
  questionFiles?: QuestionFile[] | null;
  /** Showman only until the answer is revealed. */
  answerFiles?: QuestionFile[] | null;
  subType?: string;
  showAnswerDuration?: number;
  maxPrice?: number | null;
  allowedPrices?: number[] | null;
  transferType?: TransferType | null;
  priceMultiplier?: number | null;
  showDelay?: number | null;
  answers?: ChoiceAnswer[] | null;
}

export interface AnsweredPlayer {
  player: number;
  result: number;
  score: number;
  answerType: AnswerResultType;
}

export interface AnswerShowData {
  answerFiles: QuestionFile[] | null;
  answerText: string | null;
  nextTurnPlayerId: number | null;
  answerContentPlan?: ContentPlan | null;
  answerResult?: AnsweredPlayer;
  /** Other answers that also counted as right. */
  rightAnswers?: string[] | null;
  authors?: string[] | null;
  sources?: string[] | null;
  /** Point answers: the right spot and the radius that counted. */
  answerPoint?: { x: number; y: number; imageAspectRatio?: number } | null;
  answerDeviation?: number | null;
}

export interface FinalAnswer {
  id: string;
  playerId: number;
  answer: string;
  isCorrect?: boolean | null;
  autoLoss?: boolean | null;
  submittedAt: string;
  reviewedAt?: string | null;
}

export interface FinalQuestionData {
  themeId: number;
  themeName: string;
  question: Question;
}

export interface FinalRoundData {
  phase: FinalPhase;
  turnOrder: number[];
  bids: Record<string, number>;
  answers: FinalAnswer[];
  eliminatedThemes: number[];
  questionData?: FinalQuestionData | null;
}

export interface SecretQuestionData {
  pickerPlayerId: number;
  transferType: TransferType;
  questionId: number;
  transferDecisionPhase: boolean;
  /** customPrice: the receiver picks one of these prices before the question shows. */
  priceSelection?: { playerId: number; allowedPrices: number[] } | null;
}

export interface StakeQuestionData {
  pickerPlayerId: number;
  questionId: number;
  maxPrice: number | null;
  bids: Record<string, number | null>;
  passedPlayers: number[];
  biddingOrder: number[];
  currentBidderIndex: number;
  highestBid: number | null;
  winnerPlayerId: number | null;
  biddingPhase: boolean;
}

export type ButtonPressMode = "random_within_window" | "first_wins";

/** Rules the host picked when creating the game. */
export interface GameSettings {
  /** The buzzer opens after the content; pressing earlier locks you out. */
  falseStart: boolean;
  buttonPressMode: ButtonPressMode;
  wrongAnswerPenalty?: "subtract" | "none";
  timers?: { roundMs: number } & Record<string, number>;
}

export type AllPlayMode = "noRisk" | "stake";

export type GameJoinMode = "open" | "spectators_only" | "closed";

export interface AllPlayEntry {
  playerId: number;
  /** Stake mode: the stake (0 = staked, amount hidden until the review). */
  stake: number | null;
  /** The typed answer ("" = sent, hidden until the review). */
  answer: string | null;
  submitted: boolean;
  isCorrect: boolean | null;
  scoreChange: number | null;
}

/** "Everyone answers" question: every player answers in writing. */
export interface AllPlayData {
  mode: AllPlayMode;
  questionId: number;
  themeId?: number;
  price: number;
  maxStake: number | null;
  priceMultiplier: number | null;
  entries: AllPlayEntry[];
}

export interface GameState {
  questionState: QuestionState | null;
  isPaused: boolean;
  currentRound: Round | null;
  currentQuestion: Question | null;
  answeringPlayer: number | null;
  answeredPlayers: AnsweredPlayer[] | null;
  readyPlayers: number[] | null;
  timer: Timer | null;
  questionContentPlan?: ContentPlan | null;
  /** Position on the SHOWING timer (ms) when the buzzer opens; 0/null: open now. */
  buzzerOpensAtMs?: number | null;
  /** Players locked out after a false start: id -> epoch ms (server clock) the lock ends. */
  buzzerLocks?: Record<string, number> | null;
  allPlay?: AllPlayData | null;
  /** Who may join right now; open when missing. */
  joinMode?: GameJoinMode | null;
  /** Round time limit bookkeeping (epoch ms / ms on the server clock). */
  roundStartedAt?: number | null;
  roundPausedMs?: number | null;
  pausedAt?: number | null;
  finalRoundData?: FinalRoundData | null;
  currentTurnPlayerId?: number | null;
  skippedPlayers: number[] | null;
  answerShowData?: AnswerShowData | null;
  secretQuestionData?: SecretQuestionData | null;
  stakeQuestionData?: StakeQuestionData | null;
  password?: string | null;
  questionEligiblePlayers?: number[] | null;
}

/** A line the server wrote itself: the showman action log. */
export interface ChatSystemEntry {
  /** The logged action, e.g. "answer-result" or "player-kick". */
  action: string;
  params: Record<string, string | number | boolean | null>;
}

export interface ChatMessage {
  uuid: string;
  timestamp: string;
  user: number;
  message: string;
  system?: ChatSystemEntry;
}

export interface GameJoinData {
  meta: { title: string; settings?: GameSettings };
  players: Player[];
  gameState: GameState;
  chatMessages: ChatMessage[];
}

export interface AnswerReview {
  playerId: number;
  answerId: string;
  answerText: string;
  scoreChange: number;
  answerType: FinalAnswerType;
  isCorrect: boolean | null;
}

/** Server → client events and their payloads. */
export interface ServerEvents {
  "game-data": GameJoinData;
  join: Player;
  "user-leave": { user: number };
  start: {
    currentRound: Round;
    currentTurnPlayerId?: number | null;
    roundStartedAt?: number | null;
  };
  "game-pause": { timer: Timer | null };
  "game-unpause": { timer: Timer | null };
  "player-ready": {
    playerId: number;
    isReady: boolean;
    readyPlayers: number[];
    autoStartTriggered?: boolean;
  };
  "player-unready": { playerId: number; isReady: boolean; readyPlayers: number[] };
  "media-download-status": {
    playerId: number;
    mediaDownloaded: boolean;
    allPlayersReady: boolean;
    timer: Timer | null;
    contentPlan?: ContentPlan | null;
    buzzerOpensAtMs?: number | null;
  };
  "question-data": {
    data: Question;
    timer: Timer;
    questionEligiblePlayers?: number[] | null;
    contentPlan?: ContentPlan | null;
    buzzerOpensAtMs?: number | null;
  };
  "question-answer": { userId: number; timer: Timer };
  /** Someone pressed before the buzzer opened and is locked out for `lockMs`. */
  "buzzer-false-start": { playerId: number; lockMs: number };
  "buzzer-open": { buzzerOpensAtMs: number };
  "answer-submitted": { answerText: string | null };
  "answer-result": { answerResult: AnsweredPlayer; timer: Timer | null };
  "question-finish": AnswerShowData;
  "answer-show-start": Record<string, never>;
  "answer-show-end": Record<string, never>;
  "question-skip": { playerId: number };
  "question-unskip": { playerId: number };
  "secret-question-picked": {
    pickerPlayerId: number;
    transferType: TransferType;
    questionId: number;
    questionEligiblePlayers?: number[] | null;
  };
  "secret-question-transfer": {
    fromPlayerId: number;
    toPlayerId: number;
    questionId: number;
    /** customPrice: the receiver now picks one of these prices. */
    allowedPrices?: number[] | null;
    timer?: Timer | null;
  };
  "all-play-start": {
    mode: AllPlayMode;
    questionId: number;
    players: number[];
    price: number;
    maxStake: number | null;
    priceMultiplier: number | null;
    /** Stake timer in stake mode; null when the question comes next. */
    timer: Timer | null;
  };
  "all-play-stake": { playerId: number };
  "all-play-answer": { playerId: number };
  "all-play-reviewing": { allPlay: AllPlayData };
  "all-play-review": {
    playerId: number;
    isCorrect: boolean;
    scoreChange: number;
    newScore: number;
  };
  /** The receiver of a customPrice secret question picked its price. */
  "secret-question-price": { playerId: number; price: number; questionId: number };
  "question-remove-restore": { questionId: number; isPlayed: boolean };
  "answer-result-undo": {
    playerId: number;
    revertedResult: number;
    newScore: number;
    canAnswerAgain: boolean;
  };
  "game-join-mode-change": { joinMode: GameJoinMode };
  "stake-question-picked": {
    pickerPlayerId: number;
    questionId: number;
    maxPrice: number | null;
    biddingOrder: number[];
    timer: Timer;
    questionEligiblePlayers?: number[] | null;
  };
  "stake-bid-submit": {
    playerId: number;
    bidAmount: number | null;
    bidType: StakeBidType;
    isPhaseComplete?: boolean;
    nextBidderId?: number | null;
    timer?: Timer;
  };
  "stake-question-winner": { winnerPlayerId: number; finalBid: number | null };
  "theme-eliminate": { themeId: number; eliminatedBy: number; nextPlayerId: number | null };
  "final-phase-complete": { phase: FinalPhase; nextPhase?: FinalPhase; timer?: Timer };
  "final-bid-submit": { playerId: number; bidAmount: number; isAutomatic?: boolean };
  "final-question-data": { questionData: FinalQuestionData };
  "final-answer-submit": { playerId: number };
  "final-auto-loss": { playerId: number; reason: "empty_answer" | "timeout" };
  "final-submit-end": {
    phase: FinalPhase;
    nextPhase: FinalPhase | null;
    allReviews?: AnswerReview[];
  };
  "final-answer-review": {
    answerId: string;
    playerId: number;
    isCorrect: boolean;
    scoreChange: number;
  };
  "next-round": { gameState: GameState };
  "game-finished": unknown;
  /** An admin or moderator closed the game; it no longer exists. */
  "game-closed": { gameId: string; reason: "moderator" };
  "player-role-change": { playerId: number; newRole: PlayerRole; players: Player[] };
  "player-slot-change": { playerId: number; newSlot: number; players: Player[] };
  "score-changed": { playerId: number; newScore: number };
  "turn-player-changed": { newTurnPlayerId: number | null };
  "player-kicked": { playerId: number };
  "player-restricted": { playerId: number; muted: boolean; restricted: boolean; banned: boolean };
  "chat-message": ChatMessage;
}

export type ServerEventName = keyof ServerEvents;

export type ServerEvent = {
  [K in ServerEventName]: { type: K; payload: ServerEvents[K] };
}[ServerEventName];

/** Client → server events and their payloads. */
export interface ClientEvents {
  join: { gameId: string; role: PlayerRole; targetSlot: number | null; password?: string | null };
  "user-leave": undefined;
  start: undefined;
  "game-pause": undefined;
  "game-unpause": undefined;
  "next-round": undefined;
  "player-ready": undefined;
  "player-unready": undefined;
  "media-downloaded": { mediaDurations?: { md5: string; durationMs: number }[] } | undefined;
  "question-pick": { questionId: number };
  "question-answer": undefined;
  "answer-submitted": { answerText: string | null };
  "answer-result": { scoreResult: number; answerType: AnswerResultType };
  "skip-question-force": undefined;
  "skip-show-answer": undefined;
  "question-skip": undefined;
  "question-unskip": undefined;
  "secret-question-transfer": { targetPlayerId: number };
  "secret-question-price": { price: number };
  "question-remove-restore": { questionId: number };
  "answer-result-undo": undefined;
  "buzzer-open": undefined;
  "game-join-mode-change": { joinMode: GameJoinMode };
  "all-play-stake": { amount: number };
  "all-play-answer": { answerText: string };
  "all-play-review": { playerId: number; isCorrect: boolean };
  "stake-bid-submit": { bidType: StakeBidType; bidAmount: number | null };
  "theme-eliminate": { themeId: number };
  "final-bid-submit": { bid: number };
  "final-answer-submit": { answerText: string };
  "final-answer-review": { answerId: string; isCorrect: boolean };
  "player-role-change": { playerId: number | null; newRole: PlayerRole };
  "player-slot-change": { targetSlot: number; playerId?: number };
  "player-kicked": { playerId: number };
  "player-restricted": { playerId: number; muted: boolean; restricted: boolean; banned: boolean };
  "score-changed": { playerId: number; newScore: number };
  "turn-player-changed": { newTurnPlayerId: number | null };
  "chat-message": { message: string };
}

export type ClientEventName = keyof ClientEvents;

export const SERVER_EVENT_NAMES: ServerEventName[] = [
  "game-data",
  "join",
  "user-leave",
  "start",
  "game-pause",
  "game-unpause",
  "player-ready",
  "player-unready",
  "media-download-status",
  "question-data",
  "question-answer",
  "buzzer-false-start",
  "buzzer-open",
  "answer-submitted",
  "answer-result",
  "question-finish",
  "answer-show-start",
  "answer-show-end",
  "question-skip",
  "question-unskip",
  "secret-question-picked",
  "secret-question-transfer",
  "secret-question-price",
  "all-play-start",
  "question-remove-restore",
  "answer-result-undo",
  "game-join-mode-change",
  "all-play-stake",
  "all-play-answer",
  "all-play-reviewing",
  "all-play-review",
  "stake-question-picked",
  "stake-bid-submit",
  "stake-question-winner",
  "theme-eliminate",
  "final-phase-complete",
  "final-bid-submit",
  "final-question-data",
  "final-answer-submit",
  "final-auto-loss",
  "final-submit-end",
  "final-answer-review",
  "next-round",
  "game-finished",
  "game-closed",
  "player-role-change",
  "player-slot-change",
  "score-changed",
  "turn-player-changed",
  "player-kicked",
  "player-restricted",
  "chat-message",
];
