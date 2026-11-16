import type { PointTarget } from "@/lib/pointGeometry";
import type { SecretRules } from "./secretRules";
import type { QuestionTextItem } from "@/features/upload/types";
import type { QuestionScriptDTO, QuestionScriptView } from "./questionScript";

/**
 * Socket.IO game protocol for the /games namespace.
 *
 * These types mirror the server's runtime DTOs (server/src/domain/types/**),
 * which are the source of truth. openapi/schema.json omits some socket fields, so
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
  realPrice?: number | null;
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
  placement: ContentPlacement | "replic";
  durationMs: number;
  startOffsetMs?: number;
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
  sourceLabel?: string | null;
  id?: number;
  text?: string | null;
  file: PackageFile | null;
  order: number;
}

export interface Question {
  script?: QuestionScriptDTO | null;
  id?: number;
  type: QuestionType;
  order: number;
  price: number | null;
  realPrice?: number | null;
  /** Private package/showman data; omitted in public question projection. */
  secretRules?: SecretRules | null;
  isHidden: boolean;
  text?: string | null;
  /** Position of the text in the content order; null keeps it as a caption. */
  textOrder?: number | null;
  /** Additional text steps in the same order space as question files. */
  textItems?: QuestionTextItem[] | null;
  textDurationMs?: number | null;
  textWaitForFinish?: boolean | null;
  answerDurationMs?: number | null;
  answerTextItems?: QuestionTextItem[] | null;
  showmanComments?: string | null;
  answerExplanation?: string | null;
  playMediaSimultaneously?: boolean | null;
  /** Showman only. */
  answerHint?: string | null;
  /** How the answer is given: typed/said, a number, or a spot on the picture. */
  answerType?: "text" | "number" | "point" | "select" | null;
  /** Showman only: the right number / spot, and how far off still counts. */
  answerNumber?: number | null;
  answerPoint?: PointTarget | null;
  /** Order of the target image; omitted on legacy questions. */
  pointImageOrder?: number | null;
  answerDeviation?: number | null;
  /** Showman only: other right answers and known wrong answers. */
  rightAnswers?: string[] | null;
  wrongAnswers?: string[] | null;
  /** Showman only until the answer is revealed. */
  answerText?: string | null;
  correctChoiceOrder?: number | null;
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
  choiceOrder?: number | null;
  result: number;
  score: number;
  answerType: AnswerResultType;
  answerText?: string | null;
}

export interface AnswerShowData {
  answerTextItems?: QuestionTextItem[] | null;
  answerExplanation?: string | null;
  timer?: Timer;
  answerFiles: QuestionFile[] | null;
  answerText: string | null;
  correctChoiceImage?: string | null;
  correctChoice?: ChoiceAnswer | null;
  nextTurnPlayerId: number | null;
  answerContentPlan?: ContentPlan | null;
  answerResult?: AnsweredPlayer;
  /** Other answers that also counted as right. */
  rightAnswers?: string[] | null;
  authors?: string[] | null;
  sources?: string[] | null;
  /** Point answers: the right spot and the radius that counted. */
  answerPoint?: PointTarget | null;
  answerDeviation?: number | null;
  /** Original question image for a point-answer reveal. */
  answerPointImage?: string | null;
}

export interface FinalAnswer {
  choiceOrder?: number;
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
  /** Present for final questions with an ordered content timeline. */
  contentPlan?: ContentPlan | null;
  mediaPreparationId?: string | null;
  mediaPreparationTimedOut?: boolean;
}

export interface FinalBidsByPlayerId {
  [playerId: string]: number;
}

export interface FinalRoundData {
  submittedBidPlayerIds: number[];
  phase: FinalPhase;
  turnOrder: number[];
  bids: FinalBidsByPlayerId;
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
  priceSelection?: {
    playerId: number;
    allowedPrices: number[];
    range?: { min: number; max: number; step: number } | null;
  } | null;
  step?: "transfer" | "price";
  actorPlayerId?: number | null;
  recipientPlayerId?: number | null;
  priceRevealed?: boolean;
  announcedPrice?: number | null;
  announcedRange?: { min: number; max: number; step: number } | null;
  announcedPrices?: number[] | null;
}

export interface SecretQuestionAward {
  questionId: number;
  recipientPlayerId: number;
  price: number;
  appliedChange: number;
  newScore: number;
  reason: "secretAward";
}

export interface StakeQuestionData {
  pickerPlayerId: number;
  questionId: number;
  maxPrice: number | null;
  questionPrice?: number | null;
  bids: Record<string, number | null>;
  passedPlayers: number[];
  biddingOrder: number[];
  currentBidderIndex: number;
  highestBid: number | null;
  winnerPlayerId: number | null;
  biddingPhase: boolean;
}

export type ButtonPressMode = "random_within_window" | "first_wins";

/** Rules the host picked when creating the game; the showman may change them. */
export interface GameSettings {
  autoStart?: boolean;
  /** The buzzer opens after the content; pressing earlier locks you out. */
  falseStart: boolean;
  buttonPressMode: ButtonPressMode;
  wrongAnswerPenalty?: "subtract" | "none";
  timers?: { roundMs: number } & Record<string, number>;
}

/** The showman's change: any subset of the rules and timers (ms). */
export interface GameSettingsChange {
  maxPlayers?: number;
  falseStart?: boolean;
  buttonPressMode?: ButtonPressMode;
  wrongAnswerPenalty?: "subtract" | "none";
  timers?: Record<string, number>;
}

/**
 * The lobby-wide `games` feed. The server also sends it to the game room when
 * the showman edits the title, privacy or seat count.
 */
export interface GameListEvent {
  event?: "created" | "changed" | "deleted" | string;
  data?: { id?: string; title?: string; maxPlayers?: number };
}

export type AllPlayMode = "simple" | "noRisk" | "stake";

export type GameJoinMode = "open" | "spectators_only" | "closed";

export interface AllPlayEntry {
  choiceOrder?: number;
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
  wrongAnswerPenalty?: "subtract" | "none";
  entries: AllPlayEntry[];
}

export interface QuestionTransition {
  timer: Timer;
  mediaReady: boolean;
  mediaEligiblePlayerIds?: number[];
  timedOut?: boolean;
}

export interface GameState {
  scriptFinalBids?: Record<string, number>;
  scriptView?: QuestionScriptView | null;
  questionTransition?: QuestionTransition | null;
  questionState: QuestionState | null;
  isPaused: boolean;
  currentRound: Round | null;
  currentQuestion: Question | null;
  answeringPlayer: number | null;
  submittedAnswer?: string | null;
  submittedChoiceOrder?: number | null;
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
  secretAward?: SecretQuestionAward | null;
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
  meta: { title: string; settings?: GameSettings; maxPlayers?: number };
  players: Player[];
  gameState: GameState;
  chatMessages: ChatMessage[];
}

export interface AnswerReview {
  choiceOrder?: number;
  playerId: number;
  answerId: string;
  answerText: string;
  scoreAfter?: number;
  scoreChange: number;
  answerType: FinalAnswerType;
  isCorrect: boolean | null;
}

/** Server в†’ client events and their payloads. */
export interface ServerEvents {
  "question-script-state": {
    gameState: GameState;
    scores: { playerId: number; score: number }[];
    outcomes?: {
      playerId: number;
      answerType: AnswerResultType | null;
      change: number;
      score: number;
    }[];
  };
  "game-data": GameJoinData;
  join: Player;
  "user-leave": { user: number };
  start: {
    currentRound: Round;
    currentTurnPlayerId?: number | null;
    roundStartedAt?: number | null;
  };
  "game-pause": { timer: Timer | null; questionTransition?: QuestionTransition | null };
  "game-unpause": { timer: Timer | null; questionTransition?: QuestionTransition | null };
  "player-ready": {
    playerId: number;
    isReady: boolean;
    readyPlayers: number[];
    autoStartTriggered?: boolean;
  };
  "player-unready": { playerId: number; isReady: boolean; readyPlayers: number[] };
  "media-download-status": {
    questionTransition?: QuestionTransition | null;
    playerId: number;
    mediaDownloaded: boolean;
    allPlayersReady: boolean;
    timer: Timer | null;
    contentPlan?: ContentPlan | null;
    buzzerOpensAtMs?: number | null;
    timedOut?: boolean;
  };
  "question-data": {
    questionState?: QuestionState | null;
    data: Question;
    timer: Timer | null;
    questionTransition?: QuestionTransition | null;
    questionEligiblePlayers?: number[] | null;
    contentPlan?: ContentPlan | null;
    buzzerOpensAtMs?: number | null;
  };
  "question-answer": { userId: number; timer: Timer };
  /** Someone pressed before the buzzer opened and is locked out for `lockMs`. */
  "buzzer-false-start": { playerId: number; lockMs: number };
  "buzzer-open": { buzzerOpensAtMs: number };
  "answer-submitted": { answerText: string | null; choiceOrder?: number | null };
  "answer-result": { answerResult: AnsweredPlayer; timer: Timer | null };
  "question-finish": AnswerShowData;
  "answer-show-start": Record<string, never>;
  "answer-show-end": Record<string, never>;
  "question-skip": { playerId: number };
  "question-unskip": { playerId: number };
  "secret-question-picked": {
    secretQuestionData?: SecretQuestionData | null;
    timer?: Timer | null;
    pickerPlayerId: number;
    transferType: TransferType;
    questionId: number;
    questionEligiblePlayers?: number[] | null;
  };
  "secret-question-transfer": {
    secretQuestionData?: SecretQuestionData | null;
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
    wrongAnswerPenalty?: "subtract" | "none";
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
  "secret-question-price": {
    playerId: number;
    price: number;
    questionId: number;
    secretQuestionData?: SecretQuestionData | null;
    timer?: Timer | null;
  };
  "secret-question-awarded": SecretQuestionAward & { timer: Timer | null };
  "question-remove-restore": { questionId: number; isPlayed: boolean };
  "answer-result-undo": {
    playerId: number;
    revertedResult: number;
    newScore: number;
    canAnswerAgain: boolean;
  };
  "game-join-mode-change": { joinMode: GameJoinMode };
  /** The showman changed the rules; they apply from the next timer or question. */
  "game-settings-change": {
    settings: GameSettings;
    maxPlayers?: number;
    playerSlots?: { playerId: number; slot: number }[];
  };
  /** Not in SERVER_EVENT_NAMES: the connection forwards it with its own listener. */
  games: GameListEvent;
  "stake-question-picked": {
    pickerPlayerId: number;
    questionId: number;
    maxPrice: number | null;
    questionPrice?: number | null;
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
  "final-bid-submit": { playerId: number; bidAmount?: number; isAutomatic?: boolean };
  "final-question-data": { questionData: FinalQuestionData; timer?: Timer | null };
  "final-answer-submit": { playerId: number };
  "final-auto-loss": { playerId: number; reason: "empty_answer" | "timeout" };
  "final-submit-end": {
    phase: FinalPhase;
    nextPhase: FinalPhase | null;
    bids: FinalBidsByPlayerId;
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

/** Client в†’ server events and their payloads. */
export interface ClientEvents {
  join: { gameId: string; role: PlayerRole; targetSlot: number | null; password?: string | null };
  "user-leave": undefined;
  start: undefined;
  "game-pause": undefined;
  "game-unpause": undefined;
  "next-round": undefined;
  "player-ready": undefined;
  "player-unready": undefined;
  "media-downloaded":
    | { mediaDurations?: { md5: string; durationMs: number }[]; mediaPreparationId?: string }
    | undefined;
  "question-pick": { questionId: number };
  "question-answer": undefined;
  "answer-submitted": { answerText: string | null; choiceOrder?: number };
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
  "game-settings-change": GameSettingsChange;
  "all-play-stake": { amount: number };
  "all-play-answer": { answerText: string; choiceOrder?: number };
  "all-play-review": { playerId: number; isCorrect: boolean };
  "stake-bid-submit": { bidType: StakeBidType; bidAmount: number | null };
  "theme-eliminate": { themeId: number };
  "final-bid-submit": { bid: number };
  "final-answer-submit": { answerText: string; choiceOrder?: number };
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
  "question-script-state",
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
  "secret-question-awarded",
  "all-play-start",
  "question-remove-restore",
  "answer-result-undo",
  "game-join-mode-change",
  "game-settings-change",
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
