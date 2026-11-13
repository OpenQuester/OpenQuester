import { describe, expect, it } from "@jest/globals";
import { SCORE_ABS_LIMIT } from "domain/constants/game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ShowmanToolsLogic } from "domain/logic/game/ShowmanToolsLogic";
import { QuestionScriptLogic } from "domain/logic/question/QuestionScriptLogic";
import { validateQuestionScript } from "domain/logic/question/validateQuestionScript";
import { projectScriptState, projectScriptQuestion } from "domain/mappers/projectScriptState";
import { GameMapper } from "domain/mappers/GameMapper";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import {
  PackageQuestionDTO,
  PackageQuestionSubType
} from "domain/types/dto/package/PackageQuestionDTO";
import type { QuestionScriptStep } from "domain/types/dto/package/QuestionScriptDTO";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { AllPlayMode } from "domain/types/dto/game/state/AllPlayDataDTO";
import { questionScriptScheme } from "presentation/schemes/package/questionScriptScheme";
import { secretRoundPrices } from "domain/logic/question/secretQuestionRules";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { BuzzerLogic } from "domain/logic/question/BuzzerLogic";
import { ButtonPressMode, WrongAnswerPenalty } from "domain/enums/game/GameSettings";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";

function question(
  steps: QuestionScriptStep[],
  patch: Partial<PackageQuestionDTO> = {}
): PackageQuestionDTO {
  return {
    id: 20,
    type: PackageQuestionType.SIMPLE,
    subType: PackageQuestionSubType.SIMPLE,
    order: 0,
    price: 100,
    isHidden: false,
    answerText: "42",
    answerNumber: 42,
    answerDelay: 0,
    showAnswerDuration: 5000,
    script: { version: 1, steps },
    ...patch
  };
}
const current: QuestionScriptStep = { op: "setAnswerer", mode: "current" };
const numeric: QuestionScriptStep = { op: "setAnswerType", answerType: "number" };
const ask: QuestionScriptStep = { op: "askAnswer", mode: "direct", durationMs: 15000 };

describe("QuestionScriptLogic", () => {
  it("skips an explicitly empty direct recipient set without fallback or award", () => {
    const game = buildGame("EMPTY", null);
    game.getPlayer(3, { fetchDisconnected: false })!.role = PlayerRole.SPECTATOR;
    const source = question(
      [
        { op: "setAnswerer", mode: "byCurrent", select: "exceptCurrent" },
        { op: "setAnswerType", answerType: "select", optionOrders: [0], correctChoiceOrder: 0 },
        ask,
        { op: "accept" }
      ],
      { answers: [{ order: 0, text: null, file: { type: PackageFileType.IMAGE, md5: "image" } }] }
    );
    expect(QuestionScriptLogic.start(game, source, 1, 2)).toEqual([]);
    expect(game.gameState.questionState).toBe(QuestionState.SHOWING_ANSWER);
    expect(game.gameState.scriptProgress).toBeNull();
    expect(game.getPlayer(2, { fetchDisconnected: true })?.score).toBe(200);
  });

  it("continues when the selected recipient leaves while option media is preparing", () => {
    const game = buildGame("MEDIA-LEAVE", null);
    const source = question(
      [
        current,
        { op: "setAnswerType", answerType: "select", optionOrders: [0], correctChoiceOrder: 0 },
        ask,
        { op: "accept" }
      ],
      {
        answers: [{ order: 0, text: null, file: { type: PackageFileType.IMAGE, md5: "image" } }]
      }
    );
    QuestionScriptLogic.start(game, source, 1, 2);
    expect(game.gameState.scriptProgress?.waitingFor).toBe("content");
    game.removePlayer(2);
    expect(QuestionScriptLogic.releaseMedia(game, source)).toEqual([]);
    expect(game.gameState.scriptProgress).toBeNull();
    expect(game.gameState.questionState).toBe(QuestionState.SHOWING_ANSWER);
    expect(game.getPlayer(2, { fetchDisconnected: true })?.score).toBe(200);
  });

  it("falls back to the picker when a direct ask has no recipient selection", () => {
    const game = buildGame("FALLBACK", null);
    const source = question([ask]);
    QuestionScriptLogic.start(game, source, 1, 2);
    expect(game.gameState.scriptProgress).toMatchObject({ waitingFor: "answer", answererIds: [2] });
    expect(game.gameState.answeringPlayer).toBe(2);
  });

  it("filters native all-play stakes and answers in the room fallback", () => {
    const game = buildGame("NATIVE", null);
    game.gameState.questionState = QuestionState.SHOWING;
    const entry = {
      playerId: 2,
      stake: 400,
      answer: "Private answer",
      choiceOrder: 1,
      submitted: true,
      isCorrect: null,
      scoreChange: null
    };
    game.gameState.allPlay = {
      mode: AllPlayMode.STAKE,
      questionId: 20,
      themeId: 1,
      price: 100,
      maxStake: null,
      priceMultiplier: null,
      entries: [entry]
    };
    const publicEntry = projectScriptState(game).allPlay?.entries[0];
    expect(publicEntry).toMatchObject({ stake: 0, answer: "", submitted: true });
    expect(publicEntry?.choiceOrder).toBeUndefined();
    expect(projectScriptState(game, 1, true).allPlay?.entries[0]).toEqual(entry);
    expect(game.gameState.allPlay.entries[0]).toEqual(entry);
    game.gameState.questionState = QuestionState.REVIEWING;
    expect(projectScriptState(game).allPlay?.entries[0]).toEqual(entry);
  });

  it("A24 scores each ask once and preserves the public verdict through reconnect at reveal", () => {
    let game = buildGame("SCRIPT", null);
    const source = question([
      numeric,
      current,
      ask,
      { ...ask, durationMs: 2000 },
      { op: "showContent", phase: "answer", orders: [], revealRight: true }
    ]);
    QuestionScriptLogic.start(game, source, 1, 2);
    expect(game.gameState.timer?.durationMs).toBe(15000);
    QuestionScriptLogic.submit(game, source, 2, "42");
    expect(game.getPlayer(2, { fetchDisconnected: true })?.score).toBe(300);
    expect(game.gameState.scriptProgress?.programCounter).toBe(4);
    expect(game.gameState.timer?.durationMs).toBe(2000);
    expect(projectScriptState(game, 3).answerShowData).toBeNull();
    game = GameMapper.deserializeGameHash(GameMapper.serializeGameToHash(game));
    QuestionScriptLogic.score(game, 2, AnswerResultType.CORRECT, "2:answer:2");
    expect(game.getPlayer(2, { fetchDisconnected: true })?.score).toBe(300);
    QuestionScriptLogic.submit(game, source, 2, "42");
    expect(game.getPlayer(2, { fetchDisconnected: true })?.score).toBe(400);
    expect(game.gameState.scriptProgress?.waitingFor).toBe("content");
    const reveal = projectScriptState(
      GameMapper.deserializeGameHash(GameMapper.serializeGameToHash(game)),
      3
    ).answerShowData;
    expect(reveal).toMatchObject({
      answerText: "42",
      answerResult: { player: 2, answerType: "correct", result: 100, score: 400 }
    });
    expect(reveal).not.toHaveProperty("answerResult.answerText");
  });

  it("A26/A27 serializes cursor, private actor and remaining timer without leaking the program or future content", () => {
    const game = buildGame("PRIVATE", null);
    const source = question(
      [
        { op: "setTheme" },
        { op: "showContent", phase: "question", orders: [0] },
        numeric,
        current,
        ask
      ],
      {
        textItems: [
          { order: 0, text: "Current prompt" },
          { order: 1, text: "Future answer" }
        ],
        realPrice: 500
      }
    );
    QuestionScriptLogic.start(game, source, 1, 2);
    game.gameState.isPaused = true;
    game.gameState.timer!.elapsedMs = 300;
    const resumed = GameMapper.deserializeGameHash(GameMapper.serializeGameToHash(game));
    expect(resumed.gameState.scriptProgress).toEqual(game.gameState.scriptProgress);
    expect(resumed.gameState.timer?.elapsedMs).toBe(300);
    const publicState = projectScriptState(resumed, 3);
    const json = JSON.stringify(publicState);
    expect(json).not.toContain("scriptProgress");
    expect(json).not.toContain("Future answer");
    expect(json).not.toContain("answerNumber");
    expect(json).not.toContain("realPrice");
    expect(publicState.scriptView?.waitingFor).toBe("content");
    expect(
      projectScriptQuestion(game.gameState, QuestionScriptLogic.activeQuestion(game, source)).script
    ).toBeUndefined();
  });

  it("setPrice multiply uses live realPrice once and source accept applies one terminal award", () => {
    const game = buildGame("AWARD", null);
    const source = question(
      [current, { op: "setPrice", mode: "multiply" }, numeric, ask, { op: "accept" }],
      { type: PackageQuestionType.NO_RISK, realPrice: 500, priceMultiplier: 2 }
    );
    QuestionScriptLogic.start(game, source, 1, 2);
    QuestionScriptLogic.advance(game, source);
    expect(game.gameState.currentQuestion?.price).toBe(100);
    expect(game.gameState.currentQuestion?.realPrice).toBe(1000);
    expect(source.realPrice).toBe(500);
    const outcomes = QuestionScriptLogic.submit(game, source, 2, "42");
    expect(outcomes.map((effect) => effect.answerType)).toEqual(["correct", null]);
    expect(game.getPlayer(2, { fetchDisconnected: true })?.score).toBe(2200);
    expect(game.gameState.scriptProgress).toBeNull();
    expect(game.gameState.answeredPlayers).toBeNull();
  });

  it.each([
    ["noRisk", WrongAnswerPenalty.SUBTRACT, 0],
    ["multiply", WrongAnswerPenalty.SUBTRACT, -200],
    ["withButton", WrongAnswerPenalty.NONE, 0],
    ["withButton", WrongAnswerPenalty.SUBTRACT, -100],
    ["forAll", WrongAnswerPenalty.NONE, 0],
    ["forAll", WrongAnswerPenalty.SUBTRACT, -100]
  ] satisfies [
    Exclude<Extract<QuestionScriptStep, { op: "setPrice" }>["mode"], "select">,
    WrongAnswerPenalty,
    number
  ][])("applies %s with room penalty %s", (mode, wrongAnswerPenalty, change) => {
    const game = buildGame("PRICEPOLICY", null);
    game.settings = { ...game.settings, wrongAnswerPenalty };
    const source = question([current, { op: "setPrice", mode }, numeric, ask]);
    QuestionScriptLogic.start(game, source, 1, 2);
    expect(QuestionScriptLogic.submit(game, source, 2, "7")).toEqual([
      { playerId: 2, answerType: "wrong", change, score: 200 + change }
    ]);
  });

  it("projects the active no-risk estimate and discloses a personal final bid at review", () => {
    const game = buildGame("ESTIMATE", null);
    game.gameState.currentRound!.type = PackageRoundType.FINAL;
    const source = question([current, { op: "setPrice", mode: "noRisk" }, ask], { realPrice: 100 });
    QuestionScriptLogic.start(game, source, 1, 2, { bids: { 2: 120, 3: 80 }, eligibleIds: [2, 3] });
    expect(projectScriptState(game, 2).scriptView?.scoreEstimate).toEqual({ win: 120, lose: -120 });
    expect(projectScriptState(game, 1, true).scriptView).not.toHaveProperty("scoreEstimate");
    expect(projectScriptState(game, 3).scriptView).not.toHaveProperty("scoreEstimate");
    QuestionScriptLogic.submit(game, source, 2, "test");
    expect(projectScriptState(game, 1, true).scriptView?.scoreEstimate).toEqual({
      win: 120,
      lose: -120
    });
    QuestionScriptLogic.start(game, source, 1, 2, { bids: {} });
    expect(projectScriptState(game, 2).scriptView?.scoreEstimate).toEqual({ win: 200, lose: 0 });
    game.gameState.stakeQuestionData = {
      pickerPlayerId: 2,
      questionId: source.id!,
      maxPrice: null,
      bids: { 2: 150 },
      passedPlayers: [],
      biddingOrder: [2],
      currentBidderIndex: 0,
      highestBid: 150,
      winnerPlayerId: 2,
      biddingPhase: false
    };
    expect(projectScriptState(game, 3).scriptView?.scoreEstimate).toEqual({ win: 150, lose: -150 });
    const hidden = question([current, ask], { isHidden: true, realPrice: 300 });
    QuestionScriptLogic.start(game, hidden, 1, 2, { bids: {} });
    expect(projectScriptState(game, 2).scriptView).not.toHaveProperty("scoreEstimate");
  });

  it("opens an ordinary fixed actual with the ask while keeping the board nominal", () => {
    for (const [price, realPrice] of [
      [100, 500],
      [null, 700],
      [100, 0]
    ] as const) {
      const game = buildGame("ACTUAL", null);
      if (price == null) game.gameState.currentRound!.type = PackageRoundType.FINAL;
      const source = question([current, ask], { price, realPrice });
      QuestionScriptLogic.start(game, source, 1, 2, { bids: {} });
      const player = projectScriptState(game, 2);
      expect(player.currentQuestion).toMatchObject({ price, realPrice });
      expect(player.scriptView?.scoreEstimate?.win).toBe(realPrice);
      expect(QuestionScriptLogic.answerPrice(game, 2).win).toBe(realPrice);
    }
  });

  it("preserves current option labels and withholds their key and future groups", () => {
    const game = buildGame("LABEL", null);
    const source = question(
      [
        current,
        { op: "setAnswerType", answerType: "select", optionOrders: [0, 1], correctChoiceOrder: 1 },
        ask,
        { op: "setAnswerType", answerType: "select", optionOrders: [2, 3], correctChoiceOrder: 3 },
        ask
      ],
      {
        answerText: "SOLSTICE",
        rightAnswers: ["SOLSTICE"],
        answers: [
          { order: 0, text: "Equinox", file: null, sourceLabel: "SPRING" },
          { order: 1, text: "Solstice", file: null, sourceLabel: "SOLSTICE" },
          { order: 2, text: "Future", file: null, sourceLabel: "FUTURE" },
          { order: 3, text: "Later", file: null, sourceLabel: "LATER" }
        ]
      }
    );
    QuestionScriptLogic.start(game, source, 1, 2);
    const publicQuestion = projectScriptQuestion(
      game.gameState,
      QuestionScriptLogic.activeQuestion(game, source)
    );
    expect(publicQuestion.answers?.map(({ sourceLabel }) => sourceLabel)).toEqual([
      "SPRING",
      "SOLSTICE"
    ]);
    expect(publicQuestion).not.toHaveProperty("correctChoiceOrder");
    expect(publicQuestion).not.toHaveProperty("rightAnswers");
    expect(publicQuestion).not.toHaveProperty("answerText");
  });

  it("resolves round extrema from full nominal questions, independent of hidden board values and other live games", () => {
    const source = question([
      current,
      { op: "setPrice", mode: "select", range: { min: 0, max: 0, step: 0 } },
      ask
    ]);
    const full = [
      question([], { price: 100, isHidden: true, realPrice: 9999 }),
      question([], { price: 700, isHidden: true }),
      question([], { price: -1 })
    ];
    const prices = secretRoundPrices(full);
    const first = buildGame("RANGE1", null);
    const second = buildGame("RANGE2", null);
    QuestionScriptLogic.start(first, source, 1, 2, { roundPrices: prices });
    QuestionScriptLogic.start(second, source, 1, 2, { roundPrices: prices });
    expect(first.gameState.scriptProgress?.priceRange).toEqual({ min: 100, max: 700, step: 600 });
    first.gameState.currentQuestion!.realPrice = 700;
    expect(second.gameState.currentQuestion?.realPrice).toBeUndefined();
    expect(source.realPrice).toBeUndefined();
  });

  it("price selection without announce exposes bounds to the chooser/showman only, also after reload", () => {
    const game = buildGame("PRICE", null);
    const source = question(
      [current, { op: "setPrice", mode: "select", range: { min: 10, max: 50, step: 10 } }, ask],
      { realPrice: 500 }
    );
    QuestionScriptLogic.start(game, source, 1, 2);
    const restored = GameMapper.deserializeGameHash(GameMapper.serializeGameToHash(game));
    const actor = projectScriptState(restored, 2);
    expect(actor.scriptView?.priceRange).toEqual({ min: 10, max: 50, step: 10 });
    expect(actor.currentQuestion).not.toHaveProperty("realPrice");
    expect(actor.scriptView).not.toHaveProperty("scoreEstimate");
    expect(projectScriptState(restored, 1, true).scriptView?.priceRange).toEqual(
      actor.scriptView?.priceRange
    );
    expect(projectScriptState(restored, 3).scriptView).not.toHaveProperty("priceRange");
  });

  it("scores an explicit final from its SI nominal and uses all positive final nominals for extrema", () => {
    const game = buildGame("FINALPRICE", null);
    game.gameState.currentRound!.type = PackageRoundType.FINAL;
    const source = question([current, { op: "setPrice", mode: "noRisk" }, numeric, ask], {
      price: null,
      realPrice: 100
    });
    expect(
      QuestionScriptLogic.finalRoundPrices([
        source,
        { price: null, realPrice: 300 },
        { price: null, realPrice: 0 }
      ])
    ).toEqual({ min: 100, max: 300 });
    expect(
      QuestionScriptLogic.finalRoundPrices([{ price: null }, { price: null, realPrice: 0 }])
    ).toEqual({ min: 1, max: 1 });
    QuestionScriptLogic.start(game, source, 1, 2);
    QuestionScriptLogic.submit(game, source, 2, "42");
    expect(QuestionScriptLogic.judge(game, source, 2, AnswerResultType.CORRECT)).toEqual([
      { playerId: 2, answerType: "correct", change: 200, score: 400 }
    ]);
  });

  it("preserves the explicit option order when display labels are identical", () => {
    const game = buildGame("FINALSELECT", null);
    game.gameState.currentRound!.type = PackageRoundType.FINAL;
    const source = question(
      [
        current,
        { op: "setAnswerType", answerType: "select", optionOrders: [0, 1], correctChoiceOrder: 1 },
        ask
      ],
      {
        answers: [
          { order: 0, text: "Same", file: null },
          { order: 1, text: "Same", file: null }
        ]
      }
    );
    QuestionScriptLogic.start(game, source, 1, 2);
    expect(() => QuestionScriptLogic.submit(game, source, 2, "Other", 1)).toThrow(
      ClientResponse.VALIDATION_ERROR
    );
    expect(game.gameState.scriptProgress?.submissions).toEqual([]);
    expect(QuestionScriptLogic.submit(game, source, 2, "Same", 1)).toEqual([]);
    expect(projectScriptState(game, 1, true)).toMatchObject({
      submittedAnswer: "Same",
      submittedChoiceOrder: 1
    });
    expect(game.gameState.scriptProgress?.submissions).toMatchObject([
      { choiceOrder: 1, correct: null }
    ]);
  });

  it("preserves accepted native final bids privately; manual verdict charges the personal stake even with no buzzer penalty", () => {
    const game = buildGame("FINAL", null);
    game.gameState.currentRound!.type = PackageRoundType.FINAL;
    game.gameState.finalRoundData = {
      phase: FinalRoundPhase.ANSWERING,
      turnOrder: [2, 3],
      bids: { 2: 120, 3: 80 },
      answers: [],
      eliminatedThemes: []
    };
    game.settings = { ...game.settings, wrongAnswerPenalty: WrongAnswerPenalty.NONE };
    const source = question([current, { op: "setPrice", mode: "noRisk" }, numeric, ask], {
      price: null
    });
    QuestionScriptLogic.start(game, source, 1, 2);
    expect(projectScriptState(game, 2).scriptFinalBids).toEqual({ 2: 120 });
    expect(projectScriptState(game, 1, true).scriptFinalBids).toEqual({});
    expect(QuestionScriptLogic.submit(game, source, 2, "42")).toEqual([]);
    expect(game.getPlayer(2, { fetchDisconnected: true })?.score).toBe(200);
    const effects = QuestionScriptLogic.judge(game, source, 2, AnswerResultType.WRONG);
    expect(effects).toEqual([{ playerId: 2, answerType: "wrong", change: -120, score: 80 }]);
  });

  it("A35 recognizes setTheme as a pure no-op without requiring its ignored source reference", () => {
    const game = buildGame("THEME", null);
    const source = question([{ op: "setTheme" }, current, ask]);
    const themes = structuredClone(game.gameState.currentRound!.themes);
    QuestionScriptLogic.start(game, source, 1, 2);
    expect(game.gameState.currentRound!.themes).toEqual(themes);
    expect(game.gameState.scriptProgress?.programCounter).toBe(3);
    expect(game.gameState.questionState).toBe(QuestionState.ANSWERING);
  });

  it("passes neutrally before buzz and reveals the current ask without running future asks or awards", () => {
    const game = buildGame("PASS", null);
    const source = question([
      { ...ask, mode: "button" },
      { op: "showContent", phase: "answer", orders: [], revealRight: true },
      current,
      ask,
      { op: "accept" }
    ]);
    QuestionScriptLogic.start(game, source, 1, 2);
    expect(QuestionScriptLogic.passButton(game, source, 2)).toEqual([]);
    expect(game.gameState.skippedPlayers).toEqual([2]);
    expect(game.getPlayer(2, { fetchDisconnected: true })?.score).toBe(200);
    expect(game.gameState.scriptProgress?.waitingFor).toBe("answer");
    expect(QuestionScriptLogic.revealAndStop(game, source)).toEqual([]);
    expect(game.gameState.answerShowData?.answerText).toBe("42");
    expect(QuestionScriptLogic.resume(game, source)).toEqual([]);
    expect(game.getPlayer(2, { fetchDisconnected: true })?.score).toBe(200);
    expect(game.gameState.scriptProgress).toBeNull();
  });

  it("clears the old draw when all pass and the next step stays in SHOWING", () => {
    const game = buildGame("NEXT", null);
    game.settings = { ...game.settings, buttonPressMode: ButtonPressMode.RANDOM_WITHIN_WINDOW };
    const source = question([
      { ...ask, mode: "button" },
      { ...ask, mode: "button", durationMs: 4000 }
    ]);
    QuestionScriptLogic.start(game, source, 1, 2);
    BuzzerLogic.recordPress(game, 2);
    QuestionScriptLogic.passButton(game, source, 2);
    expect(game.gameState.buzzerWindow?.presses).toEqual([]);
    BuzzerLogic.recordPress(game, 3);
    QuestionScriptLogic.passButton(game, source, 3);
    expect(game.gameState.questionState).toBe(QuestionState.SHOWING);
    expect(game.gameState.buzzerWindow).toBeNull();
    expect(game.gameState.timer?.durationMs).toBe(4000);
    expect(game.gameState.scriptProgress?.programCounter).toBe(2);
  });

  it("rejects a second direct pass or submission before the other answerer is done", () => {
    const game = buildGame("DUP", null);
    const source = question([{ op: "setAnswerer", mode: "all" }, ask]);
    QuestionScriptLogic.start(game, source, 1, 2);
    expect(QuestionScriptLogic.skipAnswer(game, source, 2)).toEqual([]);
    expect(() => QuestionScriptLogic.skipAnswer(game, source, 2)).toThrow();
    expect(() => QuestionScriptLogic.submit(game, source, 2, "42")).toThrow();
    expect(game.gameState.scriptProgress?.submissions).toHaveLength(1);
  });

  it("undoes only the applied change and effect of a wrong button selection", () => {
    const game = buildGame("UNDO", null);
    const player = game.getPlayer(2, { fetchDisconnected: false })!;
    player.score = -SCORE_ABS_LIMIT + 25;
    const source = question(
      [
        { op: "setPrice", mode: "multiply" },
        { op: "setAnswerType", answerType: "select", optionOrders: [0, 1], correctChoiceOrder: 1 },
        { ...ask, mode: "button" },
        { ...ask, mode: "button" }
      ],
      {
        answers: [
          { order: 0, text: "First", file: null },
          { order: 1, text: "Second", file: null }
        ]
      }
    );
    const state = game.gameState;
    QuestionScriptLogic.start(game, source, 1, 2);
    const answer = (id: number, order: number) => {
      state.scriptProgress!.answererIds = [id];
      state.answeringPlayer = id;
      game.setQuestionState(QuestionState.ANSWERING);
      const text = source.answers?.find((option) => option.order === order)?.text ?? null;
      return QuestionScriptLogic.submit(game, source, id, text, order);
    };
    expect(answer(2, 0)).toMatchObject([{ change: -25, score: -SCORE_ABS_LIMIT }]);
    expect(projectScriptState(game, 3).answeredPlayers).toMatchObject([{ choiceOrder: 0 }]);
    expect(ShowmanToolsLogic.undoLastRuling(game).result).toEqual({
      playerId: 2,
      revertedResult: -25,
      newScore: -SCORE_ABS_LIMIT + 25,
      canAnswerAgain: true
    });
    expect(state.scriptProgress?.appliedEffects).toEqual(["0:price"]);
    expect(state.scriptProgress?.submissions).toEqual([]);
    expect(() => ShowmanToolsLogic.undoLastRuling(game)).toThrow(ClientResponse.NOTHING_TO_UNDO);
    expect(answer(2, 0)).toMatchObject([{ change: -25, score: -SCORE_ABS_LIMIT }]);
    expect(() => answer(3, 0)).toThrow(ClientResponse.ALREADY_ANSWERED_QUESTION);
    expect(() => ShowmanToolsLogic.undoLastRuling(game)).toThrow(ClientResponse.NOTHING_TO_UNDO);
    answer(3, 1);
    expect(state.answeredPlayers).toBeNull();
    expect(answer(2, 0)).toMatchObject([{ change: 0, score: -SCORE_ABS_LIMIT }]);
    QuestionScriptLogic.revealAndStop(game, source);
    expect(ShowmanToolsLogic.undoLastRuling(game).result).toMatchObject({
      playerId: 3,
      canAnswerAgain: false
    });
    expect(state.scriptProgress?.lastCorrectResult).toBeUndefined();
    expect(state.answeredPlayers).toMatchObject([{ player: 2, choiceOrder: 0 }]);
    expect(ShowmanToolsLogic.undoLastRuling(game).result).toMatchObject({
      playerId: 2,
      canAnswerAgain: false
    });
    expect(() => ShowmanToolsLogic.undoLastRuling(game)).toThrow(ClientResponse.NOTHING_TO_UNDO);
  });

  it("fallback right reveals the selected option content, not its private source key", () => {
    const game = buildGame("SELECT", null);
    const source = question(
      [
        { op: "setAnswerType", answerType: "select", optionOrders: [0, 1], correctChoiceOrder: 1 },
        { op: "showContent", phase: "answer", orders: [], revealRight: true }
      ],
      {
        answerText: "B",
        answers: [
          { order: 0, text: "Wrong", file: null },
          { order: 1, text: "Right content", file: null }
        ]
      }
    );
    QuestionScriptLogic.start(game, source, 1, 2);
    expect(game.gameState.currentQuestion?.text).toBe("Right content");
    expect(game.gameState.answerShowData?.answerText).toBe("Right content");
  });

  it("targets the last authored image occurrence and rejects a point ask after a text fallback", () => {
    const show: QuestionScriptStep = { op: "showContent", phase: "question", orders: [0, 1, 2] };
    const point: QuestionScriptStep = { op: "setAnswerType", answerType: "point" };
    const right: QuestionScriptStep = {
      op: "showContent",
      phase: "answer",
      orders: [],
      revealRight: true
    };
    const file = { type: PackageFileType.IMAGE, md5: "same-map" };
    const content = {
      answerPoint: { x: 0.4, y: 0.6 },
      textItems: [{ order: 1, text: "Between images" }],
      questionFiles: [
        { order: 2, displayTime: null, file },
        { order: 0, displayTime: null, file }
      ]
    };
    const good = question([show, point, current, ask], content);
    expect(validateQuestionScript(good)).toBe(true);
    const game = buildGame("POINT", null);
    QuestionScriptLogic.start(game, good, 1, 2);
    QuestionScriptLogic.showContent(game, good);
    QuestionScriptLogic.resume(game, good);
    expect(game.gameState.currentQuestion?.pointImageOrder).toBe(2);
    expect(validateQuestionScript(question([show, right, point, current, ask], content))).toBe(
      false
    );
    expect(validateQuestionScript(question([point, ask], content))).toBe(false);
    expect(
      validateQuestionScript(
        question([show, point, ask], {
          ...content,
          textItems: [{ order: 2, text: "Tail" }],
          questionFiles: [
            { order: 0, displayTime: null, file },
            { order: 1, displayTime: null, file }
          ]
        })
      )
    ).toBe(false);
  });

  it("A29 counts repeated order references, and A25 rejects unknown wire operations", () => {
    const repeated = question(
      Array.from({ length: 31 }, () => ({ op: "showContent", phase: "question", orders: [0] })),
      { textItems: [{ order: 0, text: "Prompt" }] }
    );
    expect(validateQuestionScript(repeated)).toBe(false);
    expect(
      questionScriptScheme.validate({ version: 1, steps: [{ op: "runCode", code: "anything" }] })
        .error
    ).toBeDefined();
    expect(
      questionScriptScheme.validate({
        version: 1,
        steps: [{ op: "setAnswerType", answerType: "client" }]
      }).error
    ).toBeDefined();
  });

  it.each([
    [
      "missing numeric key",
      [{ op: "setAnswerType", answerType: "number" }],
      { answerNumber: null }
    ],
    ["missing point", [{ op: "setAnswerType", answerType: "point" }], { answerPoint: null }],
    ["missing option orders", [{ op: "setAnswerType", answerType: "select" }], {}],
    [
      "duplicate option orders",
      [{ op: "setAnswerType", answerType: "select", optionOrders: [0, 0], correctChoiceOrder: 0 }],
      {}
    ],
    [
      "key outside options",
      [{ op: "setAnswerType", answerType: "select", optionOrders: [0, 1], correctChoiceOrder: 2 }],
      {}
    ],
    [
      "missing option",
      [{ op: "setAnswerType", answerType: "select", optionOrders: [0, 2], correctChoiceOrder: 0 }],
      {}
    ],
    [
      "missing option list",
      [{ op: "setAnswerType", answerType: "select", optionOrders: [0, 1], correctChoiceOrder: 0 }],
      { answers: null }
    ],
    ["no content orders", [{ op: "showContent", phase: "question", orders: [] }], {}],
    ["duplicate content orders", [{ op: "showContent", phase: "question", orders: [0, 0] }], {}],
    ["missing content order", [{ op: "showContent", phase: "question", orders: [0, 1] }], {}],
    [
      "ambiguous content order",
      [{ op: "showContent", phase: "question", orders: [0] }],
      {
        questionFiles: [
          { order: 0, displayTime: null, file: { type: PackageFileType.IMAGE, md5: "map" } }
        ]
      }
    ]
  ] satisfies [string, QuestionScriptStep[], Partial<PackageQuestionDTO>][])(
    "rejects scripts with %s",
    (_name, steps, patch) => {
      expect(
        validateQuestionScript(
          question(steps, {
            answers: [
              { order: 0, text: "First", file: null },
              { order: 1, text: "Second", file: null }
            ],
            textItems: [{ order: 0, text: "Prompt" }],
            ...patch
          })
        )
      ).toBe(false);
    }
  );

  it("resolves content and option orders against each phase's own data", () => {
    const steps: QuestionScriptStep[] = [
      { op: "showContent", phase: "question", orders: [0] },
      { op: "setAnswerType", answerType: "select", optionOrders: [0, 1], correctChoiceOrder: 1 },
      ask,
      { op: "showContent", phase: "answer", orders: [0, 1] }
    ];
    const source = question(steps, {
      answers: [
        { order: 0, text: "First", file: null },
        { order: 1, text: "Second", file: null }
      ],
      textItems: [{ order: 0, text: "Prompt" }],
      answerFiles: [
        { order: 1, displayTime: null, file: { type: PackageFileType.IMAGE, md5: "map" } }
      ],
      script: { version: 1, steps, answerTextItems: [{ order: 0, text: "Explanation" }] }
    });
    expect(validateQuestionScript(source)).toBe(true);
    expect(validateQuestionScript({ ...source, answerTextItems: [] })).toBe(false);
    expect(validateQuestionScript({ ...source, script: null })).toBe(true);
  });

  it.each(["question", "answer"] as const)(
    "enforces the expanded %s limits independently",
    (phase) => {
      const file = { type: PackageFileType.IMAGE, md5: "map" };
      const content = (length: number) => {
        const files = Array.from({ length }, (_, order) => ({
          order,
          displayTime: null,
          file,
          waitForFinish: false
        }));
        return question(
          [{ op: "showContent", phase, orders: files.map(({ order }) => order) }],
          phase === "question" ? { questionFiles: files } : { answerFiles: files }
        );
      };
      expect(validateQuestionScript(content(10))).toBe(true);
      expect(validateQuestionScript(content(11))).toBe(false);
      const group = { op: "showContent", phase, orders: [0] } as const;
      for (const count of [30, 31]) {
        const steps = Array.from({ length: count }, () => ({ ...group, orders: [0] }));
        const item = [{ order: 0, text: "Text" }];
        const source = question(
          steps,
          phase === "question" ? { textItems: item } : { answerTextItems: item }
        );
        expect(validateQuestionScript(source)).toBe(count === 30);
      }
    }
  );
});
