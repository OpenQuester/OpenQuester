import { GameService } from "application/services/game/GameService";
import { MEDIA_DOWNLOAD_TIMEOUT } from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { QuestionPickLogic } from "domain/logic/question/QuestionPickLogic";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { BaseTransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import {
  GamePhase,
  getGamePhase,
  MutationResult,
  TimerResult,
  TransitionTrigger,
} from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { ChoosingToMediaDownloadingCtx } from "domain/types/socket/transition/choosing";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

/**
 * Handles transition from CHOOSING to MEDIA_DOWNLOADING.
 */
export class ChoosingToMediaDownloadingHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.CHOOSING;
  public readonly toPhase = GamePhase.MEDIA_DOWNLOADING;

  constructor(
    gameService: GameService,
    private readonly packageStore: PackageStore
  ) {
    super(gameService);
  }

  /**
   * Eligible when:
   * - Current phase is CHOOSING in a simple round
   * - Triggered by user action with a valid normal question id
   */
  public canTransition(ctx: ChoosingToMediaDownloadingCtx): boolean {
    const { game, trigger, payload } = ctx;

    if (!payload) return false;

    if (getGamePhase(game) !== this.fromPhase) return false;

    if (
      !TransitionGuards.canTransitionInRegularRound(
        game,
        QuestionState.CHOOSING
      )
    ) {
      return false;
    }

    if (trigger !== TransitionTrigger.USER_ACTION) return false;

    // Validate question existence and type; silence on failure
    try {
      const { question } = QuestionPickLogic.validateQuestionPick(
        game,
        payload.questionData
      );

      return (
        question.type !== PackageQuestionType.SECRET &&
        question.type !== PackageQuestionType.STAKE
      );
    } catch {
      return false;
    }
  }

  protected override validate(ctx: ChoosingToMediaDownloadingCtx): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  /** Transition to media downloading for non-secret/stake questions */
  protected async mutate(
    ctx: ChoosingToMediaDownloadingCtx
  ): Promise<MutationResult> {
    const { game, payload } = ctx;

    const { question, theme } = QuestionPickLogic.validateQuestionPick(
      game,
      payload!.questionData
    );

    // Set current question and mark as played
    QuestionPickLogic.processNormalQuestionPick(game, question, theme.id!);
    QuestionPickLogic.resetMediaDownloadStatus(game);

    game.setQuestionState(QuestionState.MEDIA_DOWNLOADING);

    return {
      data: {
        question: GameQuestionMapper.mapToSimpleQuestion(question),
      },
    };
  }

  protected async handleTimer(
    ctx: ChoosingToMediaDownloadingCtx,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;

    const timer = new GameStateTimer(MEDIA_DOWNLOAD_TIMEOUT);
    game.gameState.timer = timer.start();

    return {
      timer: timer.value() ?? undefined,
      timerMutations: [
        { op: "delete", key: timerKey(game.id) },
        {
          op: "set",
          key: timerKey(game.id),
          value: JSON.stringify(timer.value()!),
          pxTtl: MEDIA_DOWNLOAD_TIMEOUT,
        },
      ],
    };
  }

  /**
   * No broadcasts here: per-socket question data is handled by action handler
   * (showman gets full question, players get filtered data).
   */
  protected collectBroadcasts(
    _ctx: ChoosingToMediaDownloadingCtx,
    _mutationResult: MutationResult,
    _timerResult: TimerResult
  ): BroadcastEvent[] {
    return [];
  }
}
