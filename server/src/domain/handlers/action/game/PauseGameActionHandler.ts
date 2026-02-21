import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import {
  EmptyInputData,
  GamePauseBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for pausing a game.
 */
export class PauseGameActionHandler
  implements GameActionHandler<EmptyInputData, GamePauseBroadcastData>
{
  constructor(
    private readonly validationService: SocketGameValidationService,
    private readonly socketGameTimerService: SocketGameTimerService
  ) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<GamePauseBroadcastData>> {
    const { game, currentPlayer, timer } = ctx;

    this.validationService.validateGamePause(currentPlayer, game);

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
