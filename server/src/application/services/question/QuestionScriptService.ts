import { StakeBiddingTimeoutLogic } from "domain/logic/timer/StakeBiddingTimeoutLogic";
import { getRealPrice } from "domain/logic/question/questionPrices";
import { secretRoundPrices } from "domain/logic/question/secretQuestionRules";
import { singleton } from "tsyringe";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { GameActionType } from "domain/enums/GameActionType";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import {
  QuestionScriptLogic,
  type QuestionScriptScoreEffect
} from "domain/logic/question/QuestionScriptLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { MediaDownloadLogic } from "domain/logic/question/MediaDownloadLogic";
import { QuestionContentPlanLogic } from "domain/logic/question/QuestionContentPlanLogic";
import { AllPlayLogic } from "domain/logic/question/AllPlayLogic";
import { StakeBiddingMapper } from "domain/mappers/StakeBiddingMapper";
import { StakeBidType } from "domain/types/socket/events/game/StakeQuestionEventData";
import { timerKey, questionTransitionTimerKey } from "domain/constants/redisKeys";
import type { Game } from "domain/entities/game/Game";
import type { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { GamePauseLogic } from "domain/logic/timer/GamePauseLogic";
import { BuzzerLogic } from "domain/logic/question/BuzzerLogic";
import { QuestionTransitionLogic } from "domain/logic/question/QuestionTransitionLogic";

const SCRIPT_ACTIONS = new Set<GameActionType>([
  GameActionType.QUESTION_ANSWER,
  GameActionType.ANSWER_SUBMITTED,
  GameActionType.ANSWER_RESULT,
  GameActionType.EVERYONE_ANSWER_SUBMIT,
  GameActionType.EVERYONE_ANSWER_REVIEW,
  GameActionType.SECRET_QUESTION_TRANSFER,
  GameActionType.SECRET_QUESTION_PRICE_SELECT,
  GameActionType.STAKE_BID_SUBMIT,
  GameActionType.EVERYONE_STAKE_SUBMIT,
  GameActionType.MEDIA_DOWNLOADED,
  GameActionType.QUESTION_SKIP,
  GameActionType.QUESTION_UNSKIP,
  GameActionType.SKIP_QUESTION_FORCE,
  GameActionType.SKIP_SHOW_ANSWER,
  GameActionType.FINAL_ANSWER_SUBMIT,
  GameActionType.FINAL_ANSWER_REVIEW,
  GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED,
  GameActionType.TIMER_QUESTION_SHOWING_EXPIRED,
  GameActionType.TIMER_QUESTION_ANSWERING_EXPIRED,
  GameActionType.TIMER_BIDDING_EXPIRED,
  GameActionType.TIMER_FINAL_ANSWERING_EXPIRED
]);

/** Adapts existing queued actions to the domain continuation; never writes Redis or emits sockets. */
@singleton()
export class QuestionScriptService {
  public constructor(private readonly packageStore: PackageStore) {}

  public async startPicked(
    game: Game,
    source: PackageQuestionDTO,
    themeId: number,
    pickerId: number
  ): Promise<ActionHandlerResult<never>> {
    const effects = QuestionScriptLogic.start(game, source, themeId, pickerId, {
      roundPrices: await this.loadRoundPrices(game, source)
    });
    return this.buildScriptUpdate(game, source, effects);
  }

  public async execute(
    ctx: ActionExecutionContext<unknown>
  ): Promise<ActionHandlerResult | undefined> {
    const { game, action, currentPlayer } = ctx;
    const input = (action.payload ?? {}) as Record<string, unknown>;
    if (!SCRIPT_ACTIONS.has(action.type)) {
      return undefined;
    }
    const progress = game.gameState.scriptProgress;
    if (!progress) {
      if (action.scriptStep !== undefined) {
        throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
      }
      return undefined;
    }
    const isTimer = action.type.startsWith("timer-");
    if (
      !isTimer &&
      (action.scriptStep !== progress.programCounter ||
        action.scriptQuestionId !== progress.questionId)
    ) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
    if (isTimer && game.gameState.isPaused) {
      return { success: true, mutations: [] };
    }
    if (
      (game.gameState.isPaused && action.type !== GameActionType.MEDIA_DOWNLOADED) ||
      (!isTimer && (!currentPlayer || currentPlayer.isBanned || currentPlayer.isRestricted))
    ) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
    const found = await this.packageStore.getQuestionWithTheme(game.id, progress.questionId);
    if (!found?.question.script) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }
    const source = found.question;
    let effects: QuestionScriptScoreEffect[] = [];
    const host = currentPlayer?.role === PlayerRole.SHOWMAN;
    if (isTimer) {
      const timer = game.gameState.timer;
      const expired = new Date(input.expirationTime as string).getTime();
      if (input.timerKey === questionTransitionTimerKey(game.id)) {
        const opening = game.gameState.questionTransition;
        if (
          !opening ||
          ctx.questionTransitionTimer ||
          input.questionState !== game.gameState.questionState ||
          (Number.isFinite(expired) &&
            new Date(opening.timer.resumedAt ?? opening.timer.startedAt).getTime() > expired)
        ) {
          return { success: true, mutations: [] };
        }
        if (QuestionTransitionLogic.canShow(game)) {
          effects = QuestionScriptLogic.releaseMedia(game, source);
        }
      } else if (
        ctx.timer ||
        input.timerKey !== timerKey(game.id) ||
        input.questionState !== game.gameState.questionState ||
        !timer ||
        (Number.isFinite(expired) &&
          new Date(timer.resumedAt ?? timer.startedAt).getTime() > expired)
      ) {
        return { success: true, mutations: [] };
      } else {
        effects = this.timeout(game, source);
      }
    } else if (action.type === GameActionType.MEDIA_DOWNLOADED) {
      if (
        progress.waitingFor !== "content" ||
        game.gameState.questionState !== QuestionState.MEDIA_DOWNLOADING
      ) {
        return { success: true, mutations: [] };
      }
      const eligible =
        (currentPlayer!.role === PlayerRole.PLAYER &&
          game.isPlayerEligibleForMedia(action.playerId)) ||
        (host && game.getMediaEligiblePlayerIds()?.length === 0);
      if (!eligible || currentPlayer!.mediaDownloaded) {
        return { success: true, mutations: [] };
      }
      MediaDownloadLogic.markPlayerReady(currentPlayer!);
      QuestionContentPlanLogic.mergeMediaDurations(
        game,
        input.mediaDurations as Parameters<typeof QuestionContentPlanLogic.mergeMediaDurations>[1]
      );
      if (!game.gameState.isPaused) {
        effects = this.releaseContentIfReady(game, source);
      }
    } else if (action.type === GameActionType.QUESTION_ANSWER) {
      if (
        progress.waitingFor !== "answer" ||
        progress.mode !== "button" ||
        game.gameState.answeringPlayer != null ||
        currentPlayer!.role !== PlayerRole.PLAYER ||
        !game.isPlayerEligibleToAnswer(action.playerId) ||
        game.gameState.skippedPlayers?.includes(action.playerId) ||
        progress.submissions.some((entry) => entry.playerId === action.playerId)
      ) {
        throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
      }
      if (!game.gameState.buzzerWindow) {
        progress.answerWindowRemainingMs = game.gameState.timer
          ? Math.max(
              1,
              game.gameState.timer.durationMs -
                GamePauseLogic.calculateElapsedTime(game.gameState.timer)
            )
          : 1;
      }
      if (BuzzerLogic.acceptWindowMs(game) > 0) {
        BuzzerLogic.recordPress(game, action.playerId);
      } else {
        progress.answererIds = [action.playerId];
        progress.actorId = action.playerId;
        game.gameState.answeringPlayer = action.playerId;
        game.setQuestionState(QuestionState.ANSWERING);
        QuestionScriptLogic.timer(game, game.settings.timers.answerSubmitMs);
      }
    } else if (
      [
        GameActionType.ANSWER_SUBMITTED,
        GameActionType.EVERYONE_ANSWER_SUBMIT,
        GameActionType.FINAL_ANSWER_SUBMIT
      ].includes(action.type)
    ) {
      if (currentPlayer!.role !== PlayerRole.PLAYER) {
        throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
      }
      effects = QuestionScriptLogic.submit(
        game,
        source,
        action.playerId,
        input.answerText as string | null,
        input.choiceOrder as number | undefined
      );
    } else if (
      [
        GameActionType.ANSWER_RESULT,
        GameActionType.EVERYONE_ANSWER_REVIEW,
        GameActionType.FINAL_ANSWER_REVIEW
      ].includes(action.type)
    ) {
      if (
        !host ||
        (action.type === GameActionType.EVERYONE_ANSWER_REVIEW
          ? game.gameState.questionState !== QuestionState.REVIEWING
          : game.gameState.questionState !== QuestionState.ANSWERING)
      ) {
        throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
      }
      const id = (input.playerId as number | undefined) ?? game.gameState.answeringPlayer;
      if (id == null) {
        throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
      }
      // Oral answers are deliberately reviewable without inventing a typed submission.
      if (!progress.submissions.some((entry) => entry.playerId === id)) {
        if (progress.activeAnswerFormat !== "text") {
          throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
        }
        QuestionScriptLogic.submit(game, source, id, null);
      }
      effects = QuestionScriptLogic.judge(
        game,
        source,
        id,
        (input.isCorrect as boolean | undefined) ?? input.answerType === "correct"
      );
    } else if (action.type === GameActionType.SECRET_QUESTION_TRANSFER) {
      if (
        progress.waitingFor !== "answerer" ||
        !game.gameState.secretQuestionData?.transferDecisionPhase ||
        (!host && progress.actorId !== action.playerId)
      ) {
        throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
      }
      const id = input.targetPlayerId as number;
      const target = game.getPlayer(id, { fetchDisconnected: false });
      if (
        !target ||
        target.role !== PlayerRole.PLAYER ||
        !game.isPlayerEligibleToAnswer(id) ||
        (game.gameState.secretQuestionData.transferType ===
          PackageQuestionTransferType.EXCEPT_CURRENT &&
          id === progress.pickerId)
      ) {
        throw new ClientError(ClientResponse.VALIDATION_ERROR);
      }
      progress.answererIds = [id];
      progress.pickerId = id;
      game.gameState.secretQuestionData = null;
      effects = QuestionScriptLogic.resume(game, source);
    } else if (action.type === GameActionType.SECRET_QUESTION_PRICE_SELECT) {
      if (
        progress.waitingFor !== "price" ||
        !progress.priceRange ||
        (!host && progress.actorId !== action.playerId) ||
        !QuestionScriptLogic.allowedPrice(progress.priceRange, input.price as number)
      ) {
        throw new ClientError(ClientResponse.VALIDATION_ERROR);
      }
      game.gameState.currentQuestion!.realPrice = input.price as number;
      progress.priceRevealed = true;
      effects = QuestionScriptLogic.resume(game, source);
    } else if (action.type === GameActionType.STAKE_BID_SUBMIT) {
      const stake = game.gameState.stakeQuestionData;
      if (
        progress.waitingFor !== "answerer" ||
        !stake ||
        (!host && progress.actorId !== action.playerId)
      ) {
        throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
      }
      const id = stake.biddingOrder[stake.currentBidderIndex];
      const player = game.getPlayer(id, { fetchDisconnected: false });
      if (!player) {
        throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
      }
      const placed = StakeBiddingMapper.placeBid({
        playerId: id,
        bid:
          input.bidType === "normal"
            ? (input.bidAmount as number)
            : (input.bidType as StakeBidType),
        stakeData: stake,
        currentPlayer: player.toDTO(),
        questionPrice: getRealPrice(game.gameState.currentQuestion!) ?? 1,
        allPlayers: game.players.map((item) => item.toDTO()),
        bidTimeMs: game.settings.timers.stakeMs
      });
      game.gameState.stakeQuestionData = placed.updatedStakeData;
      if (placed.isPhaseComplete) {
        placed.updatedStakeData.biddingPhase = false;
        progress.answererIds = placed.updatedStakeData.winnerPlayerId
          ? [placed.updatedStakeData.winnerPlayerId]
          : [];
        effects = QuestionScriptLogic.resume(game, source);
      } else {
        progress.actorId = placed.nextBidderId ?? null;
        game.gameState.timer = placed.timer ?? null;
      }
    } else if (action.type === GameActionType.EVERYONE_STAKE_SUBMIT) {
      if (progress.waitingFor !== "answerer" || !game.gameState.allPlay) {
        throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
      }
      AllPlayLogic.submitStake(game, action.playerId, input.amount as number);
      if (game.gameState.allPlay.entries.every((entry) => entry.stake !== null)) {
        progress.stakes = Object.fromEntries(
          game.gameState.allPlay.entries.map((entry) => [entry.playerId, entry.stake!])
        );
        effects = QuestionScriptLogic.resume(game, source);
      }
    } else if (action.type === GameActionType.SKIP_QUESTION_FORCE) {
      if (!host || progress.waitingFor !== "answer") {
        throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
      }
      effects = QuestionScriptLogic.revealAndStop(game, source);
    } else if (action.type === GameActionType.SKIP_SHOW_ANSWER) {
      if (!host || progress.waitingFor !== "content" || progress.pendingAsk) {
        throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
      }
      effects = QuestionScriptLogic.resume(game, source);
    } else if (action.type === GameActionType.QUESTION_UNSKIP) {
      if (
        progress.waitingFor !== "answer" ||
        progress.mode !== "button" ||
        game.gameState.answeringPlayer != null
      ) {
        throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
      }
      game.gameState.skippedPlayers = (game.gameState.skippedPlayers ?? []).filter(
        (id) => id !== action.playerId
      );
    } else if (action.type === GameActionType.QUESTION_SKIP) {
      if (
        progress.waitingFor === "answer" &&
        progress.mode === "button" &&
        game.gameState.answeringPlayer == null &&
        currentPlayer!.role === PlayerRole.PLAYER
      ) {
        effects = QuestionScriptLogic.passButton(game, source, action.playerId);
      } else {
        effects = QuestionScriptLogic.skipAnswer(game, source, action.playerId);
      }
    }
    if (game.gameState.scriptProgress) {
      game.gameState.scriptView = QuestionScriptLogic.view(game);
    }
    return this.buildScriptUpdate(game, source, effects);
  }

  public async afterAction(
    ctx: ActionExecutionContext<unknown>,
    result: ActionHandlerResult,
    previousFinalPhase?: FinalRoundPhase
  ): Promise<ActionHandlerResult> {
    const game = result.broadcastGame ?? ctx.game;
    const progress = game.gameState.scriptProgress;
    if (
      result.success &&
      progress &&
      [
        GameActionType.LEAVE,
        GameActionType.DISCONNECT,
        GameActionType.PLAYER_KICK,
        GameActionType.PLAYER_ROLE_CHANGE,
        GameActionType.PLAYER_RESTRICTION,
        GameActionType.UNPAUSE
      ].includes(ctx.action.type)
    ) {
      const departure = this.departedPlayerId(ctx, game);
      if (game.gameState.isPaused) {
        if (
          departure == null ||
          (!progress.answererIds.includes(departure) && progress.actorId !== departure)
        ) {
          return result;
        }
        progress.pendingDepartureIds = [
          ...new Set([...(progress.pendingDepartureIds ?? []), departure])
        ];
        return {
          ...result,
          mutations: [...result.mutations, DataMutationConverter.saveGameMutation(game)],
          broadcastGame: game
        };
      }
      const found = await this.packageStore.getQuestionWithTheme(game.id, progress.questionId);
      if (found?.question.script) {
        const departed = new Set(progress.pendingDepartureIds ?? []);
        if (departure != null) {
          departed.add(departure);
        }
        delete progress.pendingDepartureIds;
        let effects: QuestionScriptScoreEffect[] = [];
        if (
          progress.waitingFor === "content" &&
          game.gameState.questionState === QuestionState.MEDIA_DOWNLOADING
        ) {
          effects = this.releaseContentIfReady(game, found.question);
        } else {
          const left = progress.answererIds.filter((id) => departed.has(id));
          if (progress.waitingFor === "answer" && left.length) {
            for (const id of left) {
              const entry = progress.submissions.find((submission) => submission.playerId === id);
              if (!entry) {
                progress.submissions.push({
                  playerId: id,
                  answerText: null,
                  choiceOrder: null,
                  correct: false,
                  scored: false
                });
              } else if (entry.correct === null) {
                entry.correct = false;
              }
            }
            effects = QuestionScriptLogic.finishAnswersIfReady(game, found.question);
          } else if (progress.actorId != null && departed.has(progress.actorId)) {
            effects = this.timeout(game, found.question);
          }
        }
        if (game.gameState.scriptProgress) {
          game.gameState.scriptView = QuestionScriptLogic.view(game);
        }
        const continuation = this.buildScriptUpdate(game, found.question, effects);
        return {
          ...result,
          mutations: [...result.mutations, ...continuation.mutations],
          broadcastGame: game
        };
      }
    }
    const final = game.gameState.finalRoundData;
    // Replace the native final transition before the executor saves it or emits its events.
    if (
      result.success &&
      !game.gameState.scriptProgress &&
      final &&
      final.phase !== FinalRoundPhase.THEME_ELIMINATION &&
      (previousFinalPhase === undefined || previousFinalPhase === FinalRoundPhase.THEME_ELIMINATION)
    ) {
      const remaining = game.gameState.currentRound?.themes.filter(
        (theme) => !final.eliminatedThemes.includes(theme.id)
      );
      const theme = remaining?.length === 1 ? remaining[0] : null;
      const id = theme?.questions[0]?.id;
      const found = id ? await this.packageStore.getQuestionWithTheme(game.id, id) : null;
      if (found?.question.script) {
        // Discard bids from the native transition out of theme elimination.
        const acceptedBids =
          previousFinalPhase === FinalRoundPhase.THEME_ELIMINATION ? {} : final.bids;
        const effects = QuestionScriptLogic.start(
          game,
          found.question,
          theme!.id,
          ctx.action.playerId,
          {
            bids: acceptedBids,
            eligibleIds: final.turnOrder,
            roundPrices: await this.loadRoundPrices(game, found.question)
          }
        );
        return this.buildScriptUpdate(game, found.question, effects);
      }
    }
    return result;
  }

  private departedPlayerId(ctx: ActionExecutionContext<unknown>, game: Game): number | undefined {
    const { action } = ctx;
    if (action.type === GameActionType.LEAVE) {
      return action.playerId;
    }
    if (
      action.type !== GameActionType.PLAYER_KICK &&
      action.type !== GameActionType.PLAYER_RESTRICTION &&
      action.type !== GameActionType.PLAYER_ROLE_CHANGE
    ) {
      return;
    }
    const id =
      (action.payload as { playerId?: number | null } | undefined)?.playerId ?? action.playerId;
    const player = game.getPlayer(id, { fetchDisconnected: false });
    if (!player || player.role !== PlayerRole.PLAYER || player.isRestricted || player.isBanned) {
      return id;
    }
  }

  private async loadRoundPrices(
    game: Game,
    source: PackageQuestionDTO
  ): Promise<{ min: number; max: number } | null> {
    if (
      !source.script?.steps.some(
        (step) =>
          (step.op === "announcePrice" || (step.op === "setPrice" && step.mode === "select")) &&
          step.range.min === 0 &&
          step.range.max === 0
      )
    ) {
      return null;
    }
    const ids =
      game.gameState.currentRound?.themes.flatMap((theme) =>
        theme.questions.map((question) => question.id)
      ) ?? [];
    const questions = await this.packageStore.getQuestions(game.id, ids);
    return game.gameState.currentRound?.type === PackageRoundType.FINAL
      ? QuestionScriptLogic.finalRoundPrices(questions)
      : secretRoundPrices(questions);
  }

  private timeout(game: Game, source: PackageQuestionDTO): QuestionScriptScoreEffect[] {
    const progress = QuestionScriptLogic.require(game);
    if (progress.waitingFor === "content") {
      if (game.gameState.questionState === QuestionState.MEDIA_DOWNLOADING) {
        return this.releaseContentIfReady(game, source, true);
      } else {
        return QuestionScriptLogic.resume(game, source);
      }
    } else if (progress.waitingFor === "price") {
      game.gameState.currentQuestion!.realPrice = progress.priceRange!.min;
      progress.priceRevealed = true;
      return QuestionScriptLogic.resume(game, source);
    } else if (progress.waitingFor === "answerer") {
      if (game.gameState.secretQuestionData) {
        const id = game
          .getInGamePlayers()
          .find(
            (player) =>
              game.isPlayerEligibleToAnswer(player.meta.id) &&
              (game.gameState.secretQuestionData!.transferType ===
                PackageQuestionTransferType.ANY ||
                player.meta.id !== progress.pickerId)
          )?.meta.id;
        progress.answererIds = id == null ? [] : [id];
        if (id != null) {
          progress.pickerId = id;
        }
        game.gameState.secretQuestionData = null;
      } else if (game.gameState.allPlay) {
        AllPlayLogic.fillMissingStakes(game);
        progress.stakes = Object.fromEntries(
          game.gameState.allPlay.entries.map((entry) => [entry.playerId, entry.stake!])
        );
      } else if (game.gameState.stakeQuestionData) {
        const timedOut = StakeBiddingTimeoutLogic.processTimeout(
          game,
          getRealPrice(game.gameState.currentQuestion!) ?? 1
        );
        if (!timedOut.isPhaseComplete) {
          progress.actorId = timedOut.nextBidderId;
          QuestionScriptLogic.timer(game, game.settings.timers.stakeMs);
          return [];
        }
        game.gameState.stakeQuestionData.biddingPhase = false;
        progress.answererIds = timedOut.winnerPlayerId == null ? [] : [timedOut.winnerPlayerId];
      }
      return QuestionScriptLogic.resume(game, source);
    } else if (progress.waitingFor === "answer") {
      if (progress.mode === "button" && game.gameState.buzzerWindow) {
        const winner = BuzzerLogic.drawWinner(game);
        if (winner == null) {
          QuestionScriptLogic.timer(game, progress.answerWindowRemainingMs ?? 1);
        } else {
          progress.answererIds = [winner];
          progress.actorId = winner;
          game.gameState.answeringPlayer = winner;
          game.setQuestionState(QuestionState.ANSWERING);
          QuestionScriptLogic.timer(game, game.settings.timers.answerSubmitMs);
        }
        return [];
      }
      if (progress.mode === "button" && !progress.answererIds.length) {
        return QuestionScriptLogic.resume(game, source);
      }
      for (const id of progress.answererIds) {
        if (!progress.submissions.some((entry) => entry.playerId === id)) {
          progress.submissions.push({
            playerId: id,
            answerText: null,
            choiceOrder: null,
            correct: false,
            scored: false
          });
        }
      }
      return QuestionScriptLogic.finishAnswersIfReady(game, source);
    }
    return [];
  }

  private buildScriptUpdate(
    game: Game,
    source: PackageQuestionDTO,
    effects: QuestionScriptScoreEffect[] = []
  ): ActionHandlerResult<never> {
    const active = game.gameState.scriptProgress
      ? QuestionScriptLogic.activeQuestion(game, source)
      : game.gameState.currentQuestion;
    const timer = game.gameState.timer;
    const opening = game.gameState.questionTransition;
    return {
      success: true,
      broadcastGame: game,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...effects.map((effect) =>
          DataMutationConverter.recordScriptResult(
            game.id,
            effect.playerId,
            effect.answerType,
            effect.score
          )
        ),
        DataMutationConverter.deleteTimerMutation(timerKey(game.id)),
        DataMutationConverter.deleteTimerMutation(questionTransitionTimerKey(game.id)),
        ...(!game.gameState.isPaused && timer
          ? [
              DataMutationConverter.setTimerMutation(
                timerKey(game.id),
                JSON.stringify(timer),
                Math.max(
                  1,
                  game.gameState.buzzerWindow
                    ? game.gameState.buzzerWindow.openedAt +
                        BuzzerLogic.acceptWindowMs(game) -
                        Date.now()
                    : timer.durationMs -
                        GamePauseLogic.calculateElapsedTime(timer) +
                        GamePauseLogic.startDelayMs(timer)
                )
              )
            ]
          : []),
        ...(!game.gameState.isPaused &&
        opening &&
        QuestionTransitionLogic.elapsed(game) < opening.timer.durationMs
          ? DataMutationConverter.mutationFromTimerMutations([
              QuestionTransitionLogic.timerMutation(game)
            ])
          : []),
        DataMutationConverter.gameBroadcastMutation(
          game.id,
          SocketIOGameEvents.QUESTION_SCRIPT_STATE,
          {
            question: active,
            outcomes: effects,
            scores: game.players.map((player) => ({
              playerId: player.meta.id,
              score: player.score
            }))
          },
          true
        )
      ]
    };
  }

  private releaseContentIfReady(
    game: Game,
    source: PackageQuestionDTO,
    force = false
  ): QuestionScriptScoreEffect[] {
    if (game.gameState.questionTransition) {
      QuestionTransitionLogic.refresh(game, force);
      if (game.gameState.questionTransition.mediaReady) {
        game.gameState.timer = null;
      }
      if (QuestionTransitionLogic.canShow(game)) {
        return QuestionScriptLogic.releaseMedia(game, source);
      }
    } else if (force || QuestionTransitionLogic.mediaReady(game)) {
      return QuestionScriptLogic.releaseMedia(game, source);
    }
    return [];
  }
}
