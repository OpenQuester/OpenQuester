import type { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";

/** Normalized SI data only. References are resolved by the importer, never executed as code. */
export interface ScriptNumberSet {
  min: number;
  max: number;
  step: number;
}

export type ScriptAnswerFormat = "text" | "number" | "point" | "select";

export type QuestionScriptStep =
  | {
      op: "setAnswerType";
      answerType: ScriptAnswerFormat;
      optionOrders?: number[];
      correctChoiceOrder?: number | null;
    }
  | { op: "showContent"; phase: "question" | "answer"; orders: number[]; revealRight?: boolean }
  | { op: "askAnswer"; mode: "button" | "direct"; durationMs: number | null }
  | { op: "setAnswerer"; mode: "current" | "byCurrent" | "all"; select?: "any" | "exceptCurrent" }
  | {
      op: "setAnswerer";
      mode: "stake";
      select: "highest" | "allPossible";
      stakeVisibility: "visible" | "hidden";
    }
  | { op: "announcePrice"; range: ScriptNumberSet }
  | { op: "setPrice"; mode: "select"; range: ScriptNumberSet }
  | { op: "setPrice"; mode: "multiply" | "noRisk" | "withButton" | "forAll" }
  | { op: "setTheme" }
  | { op: "accept" };

export interface QuestionScriptDTO {
  version: 1;
  answerTextItems?: {
    order: number;
    text: string;
    durationMs?: number | null;
    waitForFinish?: boolean;
    placement?: "screen" | "replic";
  }[];
  steps: QuestionScriptStep[];
}

/** Persisted with the game while its action lock is held. Keep it on the server. */
export interface QuestionScriptProgress {
  questionId: number;
  themeId: number;
  programCounter: number;
  waitingFor: "content" | "answerer" | "price" | "answer" | null;
  activeAnswerFormat: ScriptAnswerFormat;
  appliedEffects: string[];
  pickerId: number;
  answererIds: number[];
  answerersSet?: boolean;
  actorId: number | null;
  mode: "button" | "direct";
  answerWindowRemainingMs?: number;
  canReveal?: boolean;
  optionOrders: number[] | null;
  preparedOptionOrders?: number[];
  pendingAsk?: Extract<QuestionScriptStep, { op: "askAnswer" }>;
  pendingDepartureIds?: number[];
  correctChoiceOrder: number | null;
  content: Extract<QuestionScriptStep, { op: "showContent" }> | null;
  priceRange: ScriptNumberSet | null;
  announcedRange: ScriptNumberSet | null;
  priceRevealed: boolean;
  wrongPricePolicy?: "room" | "none";
  stakes: Record<number, number>;
  finalBids: Record<number, number>;
  roundPrices: { min: number; max: number } | null;
  submissions: {
    playerId: number;
    answerText: string | null;
    choiceOrder: number | null;
    correct: boolean | null;
    scored: boolean;
    unanswered?: true;
    skippedByShowman?: true;
  }[];
  final: boolean;
  lastCorrectResult?: Pick<
    GameStateAnsweredPlayerData,
    "player" | "result" | "score" | "answerType"
  >;
}

/** Current safe wait only: no operands, future content, keys, submissions or hidden prices. */
export interface ScriptScoreEstimate {
  win: number;
  lose: number;
}

export interface QuestionScriptView {
  scoreEstimate?: ScriptScoreEstimate;
  reviewScoreEstimates?: Record<string, ScriptScoreEstimate>;
  questionId: number;
  programCounter: number;
  waitingFor: QuestionScriptProgress["waitingFor"];
  actorId: number | null;
  answererIds: number[];
  answerMode: "button" | "direct";
  canReveal?: boolean;
  priceRange?: ScriptNumberSet | null;
  awards?: { playerId: number; points: number }[];
}
