import { GameActionBroadcastService } from "application/services/broadcast/GameActionBroadcastService";
import type { RealtimeGateway } from "application/ports/realtime/RealtimeGateway";
import type { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import type { SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { SocketBroadcastTarget } from "domain/enums/SocketBroadcastTarget";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { describe, expect, it, jest } from "@jest/globals";
import { SecretQuestionService } from "application/services/question/SecretQuestionService";
import { TransitionResourceService } from "application/services/game/TransitionResourceService";
import { GameService } from "application/services/game/GameService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { DataMutationType } from "domain/enums/DataMutationType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { QuestionValueLogic } from "domain/logic/question/QuestionValueLogic";
import {
  isAllowedSecretPrice,
  projectSecretQuestion,
  secretRoundPrices,
  startSecretQuestion
} from "domain/logic/question/secretQuestionRules";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { SecretTransferToAnsweringHandler } from "domain/state-machine/handlers/special-question/SecretTransferToAnsweringHandler";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import type { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageQuestionSubType } from "domain/types/dto/package/PackageQuestionDTO";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import type { SecretRules } from "domain/types/package/SecretRules";
import { SecretQuestionValidator } from "domain/validators/SecretQuestionValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import {
  buildGame,
  TestLogger
} from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

const rules: SecretRules = {
  outcome: "question",
  priceAnnouncement: "afterTransfer",
  priceChooser: "receiver",
  priceRule: { kind: "range", min: 200, max: 1000000, step: 0 }
};
function setup(secretRules: SecretRules | null = rules) {
  const game = buildGame("SECR", null);
  const question: PackageQuestionDTO = {
    ...game.gameState.currentQuestion!,
    type: PackageQuestionType.SECRET,
    transferType: PackageQuestionTransferType.EXCEPT_CURRENT,
    secretRules
  };
  const lookup = jest.fn(async () => ({
    question: structuredClone(question),
    theme: { id: 1, name: "Cell", order: 0, questions: [] }
  }));
  const store = { getQuestionWithTheme: lookup } as unknown as PackageStore;
  const service = new SecretQuestionService(
    new PhaseTransitionRouter(new TestLogger(), [new SecretTransferToAnsweringHandler()]),
    new TransitionResourceService({} as GameService, store),
    store
  );
  game.gameState.currentQuestion = null;
  game.gameState.questionState = QuestionState.SECRET_TRANSFER;
  game.gameState.secretQuestionData = startSecretQuestion(question, 2, { min: 100, max: 900 });
  return { game, question, service };
}

describe("secret rules and resolved price", () => {
  it("snapshots complete nominal extrema, excluding disabled cells and ignoring other actual values", () => {
    expect(
      secretRoundPrices([
        { price: 100, realPrice: 999999 },
        { price: 900, realPrice: 1 },
        { price: -1 },
        { price: null }
      ] as PackageQuestionDTO[])
    ).toEqual({ min: 100, max: 900 });
  });
  it("checks continuous and discrete integers without enumerating ranges", () => {
    expect(
      isAllowedSecretPrice(
        { playerId: 2, allowedPrices: [], range: { min: 100, max: 1000000, step: 0 } },
        999999
      )
    ).toBe(true);
    const endpoints = { playerId: 2, allowedPrices: [], range: { min: 100, max: 500, step: 400 } };
    expect([100, 200, 500].map((p) => isAllowedSecretPrice(endpoints, p))).toEqual([
      true,
      false,
      true
    ]);
    for (const p of [-1, 1.5, Infinity, NaN, 1000001, Number.MAX_SAFE_INTEGER])
      expect(isAllowedSecretPrice(endpoints, p)).toBe(false);
  });
  it("keeps price bounds private until transfer, then resolves only the live realPrice", async () => {
    const { game, question, service } = setup();
    const before = projectSecretQuestion(game.gameState.secretQuestionData);
    expect(before).not.toHaveProperty("roundPrices");
    expect(before).not.toHaveProperty("announcedRange");
    await service.handleSecretQuestionTransfer(
      game,
      game.getPlayer(2, { fetchDisconnected: true })!,
      { targetPlayerId: 3 }
    );
    expect(game.gameState.secretQuestionData?.priceSelection?.range).toEqual({
      min: 200,
      max: 1000000,
      step: 0
    });
    await service.handlePriceSelection(game, game.getPlayer(3, { fetchDisconnected: true })!, {
      price: 400
    });
    expect(game.gameState.currentQuestion).toMatchObject({ price: 100, realPrice: 400 });
    expect(QuestionValueLogic.effectiveValue(game)).toBe(400);
    expect(question.realPrice).toBeUndefined();
    expect(question.price).toBe(100);
    expect(setup().question.realPrice).toBeUndefined();
  });
  it("distinguishes modern publicPrice (receiver after transfer) from historical openerPrice", async () => {
    const modern = setup({ ...rules, priceAnnouncement: "beforeTransfer" });
    expect(projectSecretQuestion(modern.game.gameState.secretQuestionData)?.announcedRange).toEqual(
      { min: 200, max: 1000000, step: 0 }
    );
    expect(modern.game.gameState.secretQuestionData?.step).toBe("transfer");
    await modern.service.handleSecretQuestionTransfer(
      modern.game,
      modern.game.getPlayer(2, { fetchDisconnected: true })!,
      { targetPlayerId: 3 }
    );
    expect(modern.game.gameState.secretQuestionData?.actorPlayerId).toBe(3);
    const historical = setup({
      ...rules,
      priceAnnouncement: "beforeTransfer",
      priceChooser: "opener"
    });
    const { game, service } = historical;
    expect(game.gameState.secretQuestionData?.priceSelection?.playerId).toBe(2);
    expect(() =>
      SecretQuestionValidator.validateTransfer({
        game,
        currentPlayer: game.getPlayer(2, { fetchDisconnected: true }),
        secretData: game.gameState.secretQuestionData!,
        targetPlayerId: 3
      })
    ).toThrow();
    await expect(
      service.handlePriceSelection(game, game.getPlayer(3, { fetchDisconnected: true })!, {
        price: 400
      })
    ).rejects.toThrow();
    await service.handlePriceSelection(game, game.getPlayer(2, { fetchDisconnected: true })!, {
      price: 400
    });
    expect(game.gameState.secretQuestionData?.step).toBe("transfer");
    await service.handleSecretQuestionTransfer(
      game,
      game.getPlayer(2, { fetchDisconnected: true })!,
      { targetPlayerId: 3 }
    );
    expect(game.gameState.currentQuestion).toMatchObject({ price: 100, realPrice: 400 });
  });
  it("retains legacy OQ allowedPrices and resolves timeout to the lowest admissible price", async () => {
    const { game, question, service } = setup(null);
    question.subType = PackageQuestionSubType.CUSTOM_PRICE;
    question.allowedPrices = [500, 300];
    await service.handleSecretQuestionTransfer(
      game,
      game.getPlayer(2, { fetchDisconnected: true })!,
      { targetPlayerId: 3 }
    );
    game.getPlayer(3, { fetchDisconnected: true })!.gameStatus = PlayerGameStatus.DISCONNECTED;
    await service.handleTimeout(game);
    expect(game.gameState.currentQuestion).toMatchObject({ price: 100, realPrice: 300 });
    expect(question.allowedPrices).toEqual([500, 300]);
  });
  it("shows the SIQ question at the minimum if the only eligible player is excluded", async () => {
    const { game, service } = setup();
    game.getPlayer(3, { fetchDisconnected: true })!.gameStatus = PlayerGameStatus.DISCONNECTED;

    const result = await service.handleTimeout(game);

    expect(game.gameState.questionState).toBe(QuestionState.SHOWING);
    expect(game.gameState.currentQuestion).toMatchObject({ price: 100, realPrice: 200 });
    expect(game.gameState.answeringPlayer).toBeNull();
    expect(result.additionalMutations).toEqual([]);
    expect(result.broadcasts).toEqual([
      expect.objectContaining({ event: SocketIOGameEvents.QUESTION_DATA, roleFilter: true })
    ]);
  });
  it("persists actor and price across a serialized pause/restart and rejects paused actions", async () => {
    const { game, service } = setup();
    await service.handleSecretQuestionTransfer(
      game,
      game.getPlayer(2, { fetchDisconnected: true })!,
      { targetPlayerId: 3 }
    );
    Object.assign(game.gameState, JSON.parse(JSON.stringify(game.gameState)));
    game.gameState.isPaused = true;
    await expect(
      service.handlePriceSelection(game, game.getPlayer(3, { fetchDisconnected: true })!, {
        price: 400
      })
    ).rejects.toThrow();
    expect(game.gameState.secretQuestionData?.actorPlayerId).toBe(3);
    game.gameState.isPaused = false;
    await service.handleTimeout(game);
    expect(game.gameState.currentQuestion?.realPrice).toBe(200);
  });
  it("hides award identically before transfer and declares one score-only, clamped result", async () => {
    const ordinary = setup({ ...rules, priceRule: null });
    const { game, question, service } = setup({ ...rules, outcome: "award", priceRule: null });
    question.realPrice = 500;
    question.text = null;
    question.answerText = null;
    expect(projectSecretQuestion(game.gameState.secretQuestionData)).toEqual(
      projectSecretQuestion(ordinary.game.gameState.secretQuestionData)
    );
    const recipient = game.getPlayer(3, { fetchDisconnected: true })!;
    recipient.score = 2100000000 - 100;
    const result = await service.handleSecretQuestionTransfer(
      game,
      game.getPlayer(2, { fetchDisconnected: true })!,
      { targetPlayerId: 3 }
    );
    expect(
      result.broadcasts.filter((b) => b.event === SocketIOGameEvents.SECRET_QUESTION_AWARDED)
    ).toHaveLength(1);
    expect(
      result.broadcasts.some(
        (b) =>
          b.event === SocketIOGameEvents.ANSWER_SUBMITTED ||
          b.event === SocketIOGameEvents.QUESTION_DATA
      )
    ).toBe(false);
    expect(game.gameState.secretAward).toMatchObject({
      price: 500,
      appliedChange: 100,
      newScore: 2100000000,
      recipientPlayerId: 3
    });
    expect(game.gameState.submittedAnswer).toBeNull();
    expect(game.gameState.answerShowData).toBeNull();
    expect(result.additionalMutations).toEqual([
      {
        type: DataMutationType.UPDATE_PLAYER_STATS,
        gameId: game.id,
        userId: 3,
        payload: { action: "SECRET_AWARD", newScore: 2100000000 }
      }
    ]);
    await expect(
      service.handleSecretQuestionTransfer(game, game.getPlayer(2, { fetchDisconnected: true })!, {
        targetPlayerId: 3
      })
    ).rejects.toThrow();
    await expect(service.handleTimeout(game)).rejects.toThrow();
    expect(recipient.score).toBe(2100000000);
    expect(GameQuestionMapper.mapToSimpleQuestion(question)).not.toHaveProperty("secretRules");
  });
  it("resolves a dynamic award on timeout once and never scores the nominal fallback", async () => {
    const { game, service } = setup({ ...rules, outcome: "award" });
    await service.handleSecretQuestionTransfer(
      game,
      game.getPlayer(2, { fetchDisconnected: true })!,
      { targetPlayerId: 3 }
    );
    expect(() => QuestionValueLogic.effectiveValue(game)).toThrow();
    const result = await service.handleTimeout(game);
    expect(game.gameState.secretAward?.price).toBe(200);
    expect(result.additionalMutations).toHaveLength(1);
    await expect(service.handleTimeout(game)).rejects.toThrow();
  });
  it.each([
    { realPrice: 500, expected: 500 },
    { realPrice: 0, expected: 0 },
    { realPrice: null, expected: 100 },
    { realPrice: undefined, expected: 100 }
  ])(
    "preserves nominal and applies the fixed actual value $realPrice",
    async ({ realPrice, expected }) => {
      for (const correct of [true, false]) {
        const { game, question, service } = setup({ ...rules, priceRule: null });
        question.realPrice = realPrice;
        await service.handleSecretQuestionTransfer(
          game,
          game.getPlayer(2, { fetchDisconnected: false })!,
          { targetPlayerId: 3 }
        );
        expect(game.gameState.currentQuestion?.price).toBe(100);
        const value = QuestionValueLogic.effectiveValue(game);
        expect(value).toBe(expected);
        const result = game.handleQuestionAnswer(
          correct ? value : -value,
          correct ? AnswerResultType.CORRECT : AnswerResultType.WRONG,
          QuestionState.SHOWING_ANSWER
        );
        expect(result.appliedChange).toBe(correct || expected === 0 ? expected : -expected);
      }
    }
  );
  it("omits unannounced round extrema even in the room fallback", async () => {
    const { game } = setup({ ...rules, priceRule: { kind: "roundExtremes" } });
    const sent: unknown[] = [];
    const gateway = {
      getRoomSocketIds: async () => [],
      publish: (event: unknown) => {
        sent.push(event);
      }
    } as unknown as RealtimeGateway;
    const broadcast = new GameActionBroadcastService(
      gateway,
      {} as SocketIOQuestionService,
      {} as SocketUserDataService,
      new TestLogger()
    );
    await broadcast.emitBroadcasts(
      [
        {
          event: SocketIOGameEvents.GAME_DATA,
          gameId: game.id,
          target: SocketBroadcastTarget.GAME,
          data: {},
          useRoleBasedBroadcast: true
        }
      ],
      game
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      payload: {
        gameState: { secretQuestionData: { questionId: 20, step: "transfer", actorPlayerId: 2 } }
      }
    });
    expect(JSON.stringify(sent[0])).not.toContain("roundPrices");
    expect(JSON.stringify(sent[0])).not.toContain("announcedPrices");
  });
});
