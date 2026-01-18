import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { Game } from "domain/entities/game/Game";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { FinalRoundHandler } from "domain/handlers/socket/round/FinalRoundHandler";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { BaseTransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import {
  GamePhase,
  getGamePhase,
  MutationResult,
  TimerResult,
  TransitionContext,
} from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { FinalReviewingToGameFinishMutationData } from "domain/types/socket/transition/final";

/**
 * Result containing question answer data for game completion.
 */
export interface QuestionAnswerData {
  themeId: number;
  themeName: string;
  questionText?: string;
  answerText?: string;
}

/**
 * Handles transition from FINAL_REVIEWING → RESULTS (game finished).
 *
 * Trigger: All answers have been reviewed by showman.
 * Actions:
 * - Process round progression to finish game
 * - Emit GAME_FINISHED event
 * - Include final question/answer data
 */
export class FinalReviewingToGameFinishHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.FINAL_REVIEWING;
  public readonly toPhase = GamePhase.GAME_FINISHED;

  public constructor(
    gameService: GameService,
    socketQuestionStateService: SocketQuestionStateService,
    private readonly roundHandlerFactory: RoundHandlerFactory
  ) {
    super(gameService, socketQuestionStateService);
  }

  /**
   * Strict check for transition eligibility.
   *
   * Validates:
   * 1. Current phase must be FINAL_REVIEWING
   * 2. Game in progress + final round + correct question/phase state
   * 3. All answers must be reviewed
   */
  public canTransition(ctx: TransitionContext): boolean {
    const { game } = ctx;

    // 1. Verify we're in the expected phase
    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    // 2. Validate game state for final round reviewing
    if (
      !TransitionGuards.canTransitionInFinalRound(
        game,
        QuestionState.REVIEWING,
        FinalRoundPhase.REVIEWING
      )
    ) {
      return false;
    }

    // 3. All answers must be reviewed
    return FinalRoundStateManager.areAllAnswersReviewed(game);
  }

  /**
   * Mutate game state for game completion.
   */
  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game } = ctx;

    // Handle round progression (finishes the game)
    const roundHandler = this.roundHandlerFactory.createFromGame(game);
    const result = await roundHandler.handleRoundProgression(game, {
      forced: true,
    });

    // Get question answer data for final display
    const questionAnswerData = this._getQuestionAnswerData(game);

    return {
      data: {
        isGameFinished: result.isGameFinished,
        questionAnswerData: questionAnswerData ?? null,
      } satisfies FinalReviewingToGameFinishMutationData,
    };
  }

  /**
   * No timer setup needed - game is finished.
   */
  protected async handleTimer(
    ctx: TransitionContext,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    // Clear any existing timer on game finish
    await this.gameService.clearTimer(ctx.game.id);

    // Explicitly set timer to null in game state
    ctx.game.gameState.timer = null;

    return { timer: undefined };
  }

  /**
   * Build broadcast events for game completion.
   */
  protected collectBroadcasts(
    ctx: TransitionContext,
    _mutationResult: MutationResult,
    _timerResult: TimerResult
  ): BroadcastEvent[] {
    const { game } = ctx;

    return [
      {
        event: SocketIOGameEvents.GAME_FINISHED,
        data: true,
        room: game.id,
      },
    ];
  }

  /**
   * Get question answer data for final display.
   */
  private _getQuestionAnswerData(game: Game): QuestionAnswerData | undefined {
    const finalRoundHandler = this._getFinalRoundHandler(game);
    const remainingTheme = finalRoundHandler.getRemainingTheme(game);

    if (!remainingTheme?.id || !remainingTheme?.name) {
      return undefined;
    }

    const packageQuestion = this._getPackageQuestionByThemeId(
      game,
      remainingTheme.id
    );

    if (!packageQuestion) {
      return undefined;
    }

    return {
      themeId: remainingTheme.id,
      themeName: remainingTheme.name,
      questionText: packageQuestion.text || undefined,
      answerText: packageQuestion.answerText || undefined,
    };
  }

  /**
   * Get the final round handler.
   */
  private _getFinalRoundHandler(_game: Game): FinalRoundHandler {
    return this.roundHandlerFactory.create(
      PackageRoundType.FINAL
    ) as FinalRoundHandler;
  }

  /**
   * Get the package question by theme ID from the final round.
   */
  private _getPackageQuestionByThemeId(game: Game, themeId: number) {
    const finalRound = game.package.rounds.find(
      (round) => round.type === PackageRoundType.FINAL
    );
    if (!finalRound) {
      return undefined;
    }

    const theme = finalRound.themes.find((t) => t.id === themeId);
    if (!theme?.questions?.length) {
      return undefined;
    }

    return theme.questions[0]; // Final round themes have only one question
  }
}
