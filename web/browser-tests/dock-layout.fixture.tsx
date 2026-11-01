import { mountLobbyQuestion } from "./lobby-question.fixture";
import {
  ALICE,
  BOB,
  SHOWMAN,
  SAM,
  player,
  question,
  round,
  session,
  timer,
} from "../src/game/fixtures";
import { useGameStore } from "../src/game/store";
import { useSettings } from "../src/features/settings/settingsStore";
import { i18n, type LanguageId } from "../src/i18n";
import { DEFAULT_GAME_SETTINGS } from "../src/features/create-game/gameSettings";
export { useGameStore };

export const scenarios = [
  "choosing",
  "choosing-own",
  "media",
  "early",
  "buzz",
  "passed",
  "false-start",
  "answer",
  "answer-other",
  "auto-answer",
  "auto-submitted",
  "reveal",
  "reveal-correct",
  "secret",
  "stake",
  "stake-pending",
  "final-bid",
  "final-answer",
  "final-review",
  "all-play",
  "paused",
  "offline",
  "finished",
] as const;
export type Scenario = (typeof scenarios)[number];
export const ordinaryScenarios: readonly Scenario[] = [
  "choosing",
  "choosing-own",
  "media",
  "early",
  "buzz",
  "passed",
  "false-start",
  "answer",
  "answer-other",
  "auto-answer",
  "auto-submitted",
  "reveal",
  "reveal-correct",
  "paused",
  "offline",
  "finished",
];

export async function mount(role: "player" | "showman" | "spectator", language: LanguageId = "uk") {
  const id = role === "showman" ? SHOWMAN : role === "spectator" ? SAM : ALICE;
  mountLobbyQuestion("buzz", id);
  useSettings.getState().update({ language, pins: {} });
  await i18n.changeLanguage(language);
  setScenario("choosing");
}

/** Real models and controls at the server's 50-character name / score / price limits. */
export function setScenario(name: Scenario, limits = true) {
  const state = session(
    {
      currentRound: round(),
      currentQuestion: question(100, { text: "Question", price: limits ? 1_000_000 : 200 }),
      currentTurnPlayerId: BOB,
      questionState: "showing",
      timer: timer(120000),
      buzzerOpensAtMs: name === "early" ? 60000 : 0,
    },
    [SHOWMAN, ALICE, BOB, SAM].map((id) =>
      player(id, id === SHOWMAN ? "showman" : id === SAM ? "spectator" : "player", {
        meta: {
          id,
          username: limits ? "Ш".repeat(50) : ["", "Олексій", "Софія", "Марта", "Андрій"][id]!,
          avatar: null,
        },
        score: limits ? 2_100_000_000 : 1200,
      }),
    ),
  );
  state.settings = { ...DEFAULT_GAME_SETTINGS, falseStart: true };
  const s = state.state;
  if (name.startsWith("choosing")) s.questionState = "choosing";
  if (name === "choosing-own") s.currentTurnPlayerId = ALICE;
  if (name === "media") s.questionState = "media_downloading";
  if (name === "passed") s.skippedPlayers = [ALICE];
  if (name === "false-start") s.buzzerLocks = { [ALICE]: Date.now() + 3000 };
  if (["answer", "answer-other", "auto-answer", "auto-submitted"].includes(name)) {
    s.questionState = "answering";
    s.answeringPlayer = ALICE;
    if (name.startsWith("auto")) s.currentQuestion!.answerType = "number";
    if (name === "answer-other") s.answeringPlayer = BOB;
    if (name === "auto-submitted") state.hasAnswerSubmission = true;
  }
  if (name.startsWith("reveal")) {
    s.questionState = "showing_answer";
    s.answerShowData = { answerText: "Answer", answerFiles: [], nextTurnPlayerId: BOB };
    if (name === "reveal-correct")
      s.answerShowData.answerResult = {
        player: ALICE,
        answerType: "correct",
        result: s.currentQuestion!.price!,
        score: limits ? 2_100_000_000 : 1400,
      };
  }
  if (name === "secret") {
    s.questionState = "secret_transfer";
    s.secretQuestionData = {
      questionId: 100,
      pickerPlayerId: ALICE,
      transferType: "any",
      transferDecisionPhase: true,
    };
  }
  if (name.startsWith("stake")) {
    s.questionState = "bidding";
    s.currentTurnPlayerId = ALICE;
    s.stakeQuestionData = {
      questionId: 100,
      pickerPlayerId: BOB,
      maxPrice: null,
      bids: { [BOB]: 1_000_000 },
      passedPlayers: [],
      biddingOrder: [ALICE, BOB],
      currentBidderIndex: 0,
      highestBid: 1_000_000,
      winnerPlayerId: null,
      biddingPhase: true,
    };
  }
  if (name.startsWith("final")) {
    s.currentRound = round("final");
    s.finalRoundData = {
      phase: name === "final-bid" ? "bidding" : name === "final-answer" ? "answering" : "reviewing",
      bids: name === "final-bid" ? {} : { [ALICE]: 2_100_000_000 },
      answers: [],
      turnOrder: [ALICE, BOB],
      eliminatedThemes: [],
      questionData: { themeId: 10, themeName: "Final", question: s.currentQuestion! },
    };
    s.questionState =
      s.finalRoundData.phase === "bidding"
        ? "bidding"
        : s.finalRoundData.phase === "answering"
          ? "answering"
          : "reviewing";
  }
  if (name === "all-play")
    s.allPlay = {
      mode: "noRisk",
      questionId: 100,
      price: 1_000_000,
      maxStake: null,
      priceMultiplier: 2,
      entries: [ALICE, BOB].map((playerId) => ({
        playerId,
        stake: null,
        answer: null,
        submitted: false,
        isCorrect: null,
        scoreChange: null,
      })),
    };
  s.isPaused = name === "paused";
  state.finished = name === "finished";
  useGameStore.setState({
    session: state,
    questionPresentation: null,
    connection: name === "offline" ? "reconnecting" : "connected",
    pending: name === "stake-pending" ? { action: "stake-bid-submit", at: Date.now() } : null,
  });
}
