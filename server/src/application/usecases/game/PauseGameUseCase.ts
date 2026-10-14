import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  type EmptyInputData,
  type GamePauseBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { GameValidator } from "domain/validators/GameValidator";

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
    /** `moderator: true` is the admin panel action: no showman in the loop. */
    private readonly options: { moderator: boolean } = { moderator: false }
  ) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<GamePauseBroadcastData>> {
    if (!this.options.moderator) {
      GameValidator.validatePlayerAuthenticated(ctx);

      if (ctx.currentPlayer.role !== PlayerRole.SHOWMAN) {
        throw new ClientError(ClientResponse.ONLY_SHOWMAN_CAN_PAUSE);
      }
    }

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
