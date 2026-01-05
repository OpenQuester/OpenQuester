import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { MEDIA_DOWNLOAD_TIMEOUT } from "domain/constants/game";
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
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { ChoosingToMediaDownloadingCtx } from "domain/types/socket/transition/choosing";

/**
 * Handles transition from CHOOSING to MEDIA_DOWNLOADING.
 */
export class ChoosingToMediaDownloadingHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.CHOOSING;
  public readonly toPhase = GamePhase.MEDIA_DOWNLOADING;

  constructor(
    gameService: GameService,
    timerService: SocketQuestionStateService
  ) {
    super(gameService, timerService);
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
        payload.questionId
      );

      // TODO: Should handle special question picks (secret, bidding, stake, etc..)
      return question.type === PackageQuestionType.SIMPLE;
    } catch {
      return false;
    }
  }

  protected override validate(ctx: ChoosingToMediaDownloadingCtx): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(
    ctx: ChoosingToMediaDownloadingCtx
  ): Promise<MutationResult> {
    const { game, payload } = ctx;
    const questionId = payload!.questionId;

    const { question, theme } = QuestionPickLogic.validateQuestionPick(
      game,
      questionId
    );

    // Set current question and mark as played
    QuestionPickLogic.processNormalQuestionPick(game, question, theme.id!);
    QuestionPickLogic.resetMediaDownloadStatus(game);

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

    await this.gameService.clearTimer(game.id);

    const timerEntity = await this.timerService.setupQuestionTimer(
      game,
      MEDIA_DOWNLOAD_TIMEOUT,
      QuestionState.MEDIA_DOWNLOADING
    );

    return { timer: timerEntity.value() ?? undefined };
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
