import { ShowAnswerLogic } from "domain/logic/question/ShowAnswerLogic";
import { MAX_QUESTION_PRICE_UPLOAD } from "domain/constants/game";
import { singleton } from "tsyringe";

import { TransitionResourceService } from "application/services/game/TransitionResourceService";
import { timerKey } from "domain/constants/redisKeys";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { DataMutationType } from "domain/enums/DataMutationType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import { QuestionContentPlanLogic } from "domain/logic/question/QuestionContentPlanLogic";
import { QuestionPickLogic } from "domain/logic/question/QuestionPickLogic";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { getRealPrice } from "domain/logic/question/questionPrices";
import { customSecretPrices } from "domain/logic/question/secretQuestionPrices";
import {
  announceSecretPrice,
  awardSecretQuestion,
  isAllowedSecretPrice,
  projectSecretQuestion,
  secretPriceSelection
} from "domain/logic/question/secretQuestionRules";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { MutationAction } from "domain/types/action/DataMutation";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import {
  PackageQuestionDTO,
  PackageQuestionSubType
} from "domain/types/dto/package/PackageQuestionDTO";
import type {
  CompleteSecretQuestionTransferInput,
  SecretQuestionTransferContextResult
} from "domain/types/question/SecretQuestionTransferTypes";
import type {
  SecretQuestionPriceInputData,
  SecretQuestionTransferInputData,
  SecretQuestionAwardedPayload
} from "domain/types/socket/game/SecretQuestionTransferData";
import { SecretTransferToAnsweringPayload } from "domain/types/socket/transition/special-question";
import { SecretQuestionValidator } from "domain/validators/SecretQuestionValidator";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

/** Orchestrates the existing transfer/price actions; rules and projections are pure domain logic. */
@singleton()
export class SecretQuestionService {
  constructor(
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    private readonly transitionResourceService: TransitionResourceService,
    private readonly packageStore: PackageStore
  ) {}

  public async handleSecretQuestionTransfer(
    game: Game,
    currentPlayer: Player,
    input: SecretQuestionTransferInputData
  ): Promise<SecretQuestionTransferContextResult> {
    GameStateValidator.validateGameInProgress(game);
    SecretQuestionValidator.validateTransfer({
      game,
      currentPlayer,
      secretData: game.gameState.secretQuestionData ?? null,
      targetPlayerId: input.targetPlayerId
    });
    return this.transfer(
      game,
      input.targetPlayerId,
      await this.loadQuestion(game, game.gameState.secretQuestionData!.questionId),
      TransitionTrigger.USER_ACTION,
      currentPlayer.meta.id
    );
  }

  public async handlePriceSelection(
    game: Game,
    currentPlayer: Player,
    input: SecretQuestionPriceInputData
  ): Promise<SecretQuestionTransferContextResult> {
    GameStateValidator.validateGameInProgress(game);
    SecretQuestionValidator.validatePriceSelection({
      game,
      currentPlayer,
      secretData: game.gameState.secretQuestionData ?? null,
      price: input.price
    });
    return this.selectPrice(game, input.price, TransitionTrigger.USER_ACTION);
  }

  public async handleTimeout(game: Game): Promise<SecretQuestionTransferContextResult> {
    const data = game.gameState.secretQuestionData;
    if (game.gameState.questionState !== QuestionState.SECRET_TRANSFER || !data) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
    const question = await this.loadQuestion(game, data.questionId);
    if (data.priceSelection) {
      const selection = data.priceSelection;
      const price = selection.range?.min ?? selection.allowedPrices[0];
      if (price === undefined) {
        throw new ClientError(ClientResponse.INVALID_SECRET_QUESTION_PRICE);
      }
      const recipientId =
        data.recipientPlayerId ??
        (question.secretRules?.priceChooser === "opener" ? null : selection.playerId);
      if (recipientId == null) {
        return this.selectPrice(game, price, TransitionTrigger.TIMER_EXPIRED, question);
      }
      const recipient = game.getPlayer(recipientId, {
        fetchDisconnected: !!question.secretRules
      });
      if (
        recipient?.role === PlayerRole.PLAYER &&
        !recipient.isBanned &&
        !recipient.isRestricted &&
        game.isPlayerEligibleToAnswer(recipient.meta.id)
      ) {
        return this.selectPrice(game, price, TransitionTrigger.TIMER_EXPIRED, question);
      }
      data.realPrice = price;
    }
    const players = game
      .getInGamePlayers()
      .filter(
        (player) =>
          player.role === PlayerRole.PLAYER &&
          !player.isBanned &&
          !player.isRestricted &&
          game.isPlayerEligibleToAnswer(player.meta.id)
      );
    const others = players.filter((player) => player.meta.id !== data.pickerPlayerId);
    const candidates =
      others.length || (question.secretRules && data.transferType !== PackageQuestionTransferType.ANY)
        ? others
        : players;
    if (!candidates.length) {
      return question.secretRules?.outcome === "award"
        ? this.endWithoutRecipient(game, data.pickerPlayerId, data.questionId)
        : this.showQuestionWithoutRecipient(game, question);
    }
    // A removed award recipient cannot transfer their earned bonus to somebody else.
    if (data.recipientPlayerId != null && question.secretRules?.outcome === "award") {
      return this.endWithoutRecipient(game, data.pickerPlayerId, data.questionId);
    }
    const target = candidates[Math.floor(Math.random() * candidates.length)]!;
    const legacyPrices = customSecretPrices(question);
    if (legacyPrices && data.realPrice == null) {
      data.realPrice = legacyPrices[0];
    }
    return this.transfer(game, target.meta.id, question, TransitionTrigger.TIMER_EXPIRED);
  }

  private async endWithoutRecipient(
    game: Game,
    pickerPlayerId: number,
    questionId: number
  ): Promise<SecretQuestionTransferContextResult> {
    game.gameState.secretQuestionData = null;
    game.setQuestionState(QuestionState.SHOWING_ANSWER);
    const transition = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.TIMER_EXPIRED,
      triggeredBy: { isSystem: true },
      resources: await this.transitionResourceService.getNextRound(game)
    });
    if (!transition) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
    const result = this.result(game, pickerPlayerId, questionId, null);
    result.timerMutations = transition.timerMutations ?? [];
    result.broadcasts = transition.broadcasts;
    return result;
  }

  private showQuestionWithoutRecipient(
    game: Game,
    source: PackageQuestionDTO
  ): SecretQuestionTransferContextResult {
    const data = game.gameState.secretQuestionData!;
    const selection = secretPriceSelection(source, data, data.pickerPlayerId);
    const question = {
      ...source,
      realPrice:
        data.realPrice ?? selection?.range?.min ?? selection?.allowedPrices[0] ?? source.realPrice
    };
    game.gameState.secretQuestionData = null;
    game.setQuestionState(QuestionState.SHOWING);
    game.gameState.currentQuestion = GameQuestionMapper.mapToSimpleQuestion(question, true);
    QuestionPickLogic.resetMediaDownloadStatus(game);
    QuestionContentPlanLogic.applyToGame(game);

    const timer = this.startTimer(game, QuestionContentPlanLogic.questionTimerDuration(game));
    const result = this.result(game, data.pickerPlayerId, question.id!, timer);
    result.timerMutations = this.timerMutations(game, timer);
    result.broadcasts.push({
      event: SocketIOGameEvents.QUESTION_DATA,
      room: game.id,
      roleFilter: true,
      data: {
        data: question,
        timer: timer.value(),
        questionEligiblePlayers: game.getQuestionEligiblePlayers(),
        contentPlan: game.gameState.questionContentPlan ?? null,
        buzzerOpensAtMs: game.gameState.buzzerOpensAtMs ?? null
      }
    });
    return result;
  }

  private async completeTransfer(
    game: Game,
    input: CompleteSecretQuestionTransferInput
  ): Promise<SecretQuestionTransferContextResult> {
    const data = game.gameState.secretQuestionData!;
    const dynamicPrice =
      input.question.secretRules?.priceRule ||
      (!input.question.secretRules &&
        input.question.subType === PackageQuestionSubType.CUSTOM_PRICE);
    if (dynamicPrice && input.price == null && data.realPrice == null) {
      throw new ClientError(ClientResponse.INVALID_SECRET_QUESTION_PRICE);
    }
    const question = {
      ...input.question,
      realPrice: input.price ?? data.realPrice ?? input.question.realPrice
    };
    const actualPrice = getRealPrice(question);
    if (
      actualPrice === null ||
      !Number.isSafeInteger(actualPrice) ||
      actualPrice < 0 ||
      actualPrice > MAX_QUESTION_PRICE_UPLOAD
    ) {
      throw new ClientError(ClientResponse.INVALID_SECRET_QUESTION_PRICE);
    }
    if (question.secretRules?.outcome === "award") {
      return this.completeAward(game, question, input.targetPlayerId);
    }
    // SECRET_TRANSFER -> ANSWERING only after both transfer and dynamic price are resolved.
    const transition =
      await this.phaseTransitionRouter.tryTransition<SecretTransferToAnsweringPayload>({
        game,
        trigger: input.trigger,
        triggeredBy:
          input.triggeredBy == null
            ? { isSystem: true }
            : { isSystem: false, playerId: input.triggeredBy },
        payload: {
          targetPlayerId: input.targetPlayerId,
          ...(question.realPrice == null ? {} : { price: question.realPrice })
        },
        resources: this.transitionResourceService.fromSimpleQuestion(question)
      });
    if (!transition) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
    const result = this.result(
      game,
      input.targetPlayerId,
      data.questionId,
      transition.timer ? GameStateTimer.fromDTO(transition.timer) : null
    );
    result.question = question;
    result.price = getRealPrice(question);
    result.timerMutations = transition.timerMutations ?? [];
    result.broadcasts.push(...transition.broadcasts);
    result.broadcasts.push({
      event: SocketIOGameEvents.QUESTION_DATA,
      room: game.id,
      roleFilter: true,
      data: {
        data: question,
        timer: transition.timer ?? null,
        questionEligiblePlayers: game.getQuestionEligiblePlayers(),
        contentPlan: game.gameState.questionContentPlan ?? null,
        buzzerOpensAtMs: game.gameState.buzzerOpensAtMs ?? null
      }
    });
    return result;
  }

  private async transfer(
    game: Game,
    targetPlayerId: number,
    question: PackageQuestionDTO,
    trigger: TransitionTrigger,
    fromPlayerId?: number
  ): Promise<SecretQuestionTransferContextResult> {
    const data = game.gameState.secretQuestionData!;
    data.recipientPlayerId = targetPlayerId;
    if (!data.priceRevealed) {
      announceSecretPrice(question, data);
    }
    const selection =
      data.realPrice == null ? secretPriceSelection(question, data, targetPlayerId) : null;
    let result: SecretQuestionTransferContextResult;
    if (selection) {
      data.transferDecisionPhase = false;
      data.priceSelection = selection;
      data.step = "price";
      data.actorPlayerId = targetPlayerId;
      result = this.waitForDecision(game, targetPlayerId);
    } else {
      result = await this.completeTransfer(game, {
        targetPlayerId,
        question,
        trigger,
        triggeredBy: fromPlayerId
      });
    }
    result.fromPlayerId = fromPlayerId ?? data.pickerPlayerId;
    result.broadcasts.unshift({
      event: SocketIOGameEvents.SECRET_QUESTION_TRANSFER,
      room: game.id,
      data: {
        fromPlayerId: result.fromPlayerId,
        toPlayerId: targetPlayerId,
        questionId: data.questionId,
        allowedPrices: selection?.allowedPrices ?? null,
        secretQuestionData: projectSecretQuestion(game.gameState.secretQuestionData),
        timer: result.timer?.value() ?? null
      }
    });
    return result;
  }

  private async selectPrice(
    game: Game,
    price: number,
    trigger: TransitionTrigger,
    loadedQuestion?: PackageQuestionDTO
  ): Promise<SecretQuestionTransferContextResult> {
    const data = game.gameState.secretQuestionData!;
    if (!data.priceSelection || !isAllowedSecretPrice(data.priceSelection, price)) {
      throw new ClientError(ClientResponse.INVALID_SECRET_QUESTION_PRICE);
    }
    const actor = data.priceSelection.playerId;
    const question = loadedQuestion ?? (await this.loadQuestion(game, data.questionId));
    data.realPrice = price;
    let result: SecretQuestionTransferContextResult;
    if (data.recipientPlayerId == null && question.secretRules?.priceChooser === "opener") {
      data.priceSelection = null;
      data.step = "transfer";
      data.actorPlayerId = data.pickerPlayerId;
      data.transferDecisionPhase = true;
      result = this.waitForDecision(game, data.pickerPlayerId);
    } else {
      const recipient = data.recipientPlayerId ?? actor;
      // A receiver leaving during price choice still receives their accepted transfer.
      result = await this.completeTransfer(game, {
        targetPlayerId: recipient,
        question,
        price,
        trigger,
        triggeredBy: trigger === TransitionTrigger.USER_ACTION ? actor : undefined
      });
    }
    result.price = price;
    result.broadcasts.unshift({
      event: SocketIOGameEvents.SECRET_QUESTION_PRICE,
      room: game.id,
      data: {
        playerId: actor,
        price,
        questionId: data.questionId,
        secretQuestionData: projectSecretQuestion(game.gameState.secretQuestionData),
        timer: result.timer?.value() ?? null
      }
    });
    return result;
  }

  private completeAward(
    game: Game,
    question: PackageQuestionDTO,
    targetPlayerId: number
  ): SecretQuestionTransferContextResult {
    const award = awardSecretQuestion(game, question, targetPlayerId);
    game.gameState.secretQuestionData = null;
    game.gameState.secretAward = award;
    game.gameState.currentQuestion = null;
    game.gameState.answerShowData = null;
    game.gameState.answeringPlayer = null;
    game.gameState.submittedAnswer = null;
    game.gameState.submittedChoiceOrder = null;
    game.gameState.currentTurnPlayerId = targetPlayerId;
    game.setQuestionState(QuestionState.SHOWING_ANSWER);
    const timer = this.startTimer(
      game,
      ShowAnswerLogic.calculateShowAnswerDuration({ ...question, answerFiles: null })
    );
    const result = this.result(game, targetPlayerId, award.questionId, timer);
    result.price = award.price;
    result.timerMutations = this.timerMutations(game, timer);
    result.additionalMutations.push({
      type: DataMutationType.UPDATE_PLAYER_STATS,
      gameId: game.id,
      userId: targetPlayerId,
      payload: { action: MutationAction.SECRET_AWARD, newScore: award.newScore }
    });
    result.broadcasts.push({
      event: SocketIOGameEvents.SECRET_QUESTION_AWARDED,
      room: game.id,
      data: { ...award, timer: timer.value() } satisfies SecretQuestionAwardedPayload
    });
    return result;
  }

  private waitForDecision(game: Game, targetPlayerId: number): SecretQuestionTransferContextResult {
    const timer = this.startTimer(game, game.settings.timers.secretTransferMs);
    const result = this.result(
      game,
      targetPlayerId,
      game.gameState.secretQuestionData!.questionId,
      timer
    );
    result.allowedPrices = game.gameState.secretQuestionData?.priceSelection?.allowedPrices ?? null;
    result.timerMutations = this.timerMutations(game, timer);
    return result;
  }

  private result(
    game: Game,
    targetPlayerId: number,
    questionId: number,
    timer: GameStateTimer | null
  ): SecretQuestionTransferContextResult {
    return {
      game,
      fromPlayerId: game.gameState.secretQuestionData?.pickerPlayerId ?? targetPlayerId,
      toPlayerId: targetPlayerId,
      questionId,
      timer,
      question: null,
      allowedPrices: null,
      price: null,
      timerMutations: [],
      broadcasts: [],
      additionalMutations: []
    };
  }

  private startTimer(game: Game, durationMs: number): GameStateTimer {
    const timer = new GameStateTimer(durationMs);
    game.gameState.timer = timer.start();
    return timer;
  }

  private timerMutations(
    game: Game,
    timer: GameStateTimer
  ): SecretQuestionTransferContextResult["timerMutations"] {
    return [
      { op: "delete", key: timerKey(game.id) },
      {
        op: "set",
        key: timerKey(game.id),
        value: JSON.stringify(timer.value()),
        pxTtl: timer.value()!.durationMs
      }
    ];
  }

  private async loadQuestion(game: Game, questionId: number): Promise<PackageQuestionDTO> {
    const question = await this.packageStore.getQuestionWithTheme(game.id, questionId);
    if (!question) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }
    return question.question;
  }
}
