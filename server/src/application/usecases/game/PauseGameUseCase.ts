import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { ShowmanAction } from "domain/types/game/ShowmanAction";
import {
  type EmptyInputData,
  type GamePauseBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Handles pausing a game.
 *
 * Validates showman role and game-in-progress state, then builds
 * timer pause mutations.
 */
export class PauseGameUseCase
  implements GameActionHandler<EmptyInputData, GamePauseBroadcastData>
{
  constructor(
    private readonly socketGameTimerService: SocketGameTimerService,
    private readonly socketGameValidationService: SocketGameValidationService
  ) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<GamePauseBroadcastData>> {
    await this.socketGameValidationService.validateShowmanOrModerator(ctx, ShowmanAction.PAUSE);

    const { game, timer } = ctx;

    GameStateValidator.validateGameInProgress(game);

    const { result, timerMutations } =
      this.socketGameTimerService.buildPauseTimerMutations(game, timer);

    const pauseData: GamePauseBroadcastData = { timer: result.data.timer };

    return {
      success: true,
      data: pauseData,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromTimerMutations(timerMutations),
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          result.broadcasts
        ),
      ],
    };
  }
}
