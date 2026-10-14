import { GameService } from "application/services/game/GameService";
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
  type GameUnpauseBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { GameValidator } from "domain/validators/GameValidator";

/**
 * Handles unpausing a game.
 *
 * Validates showman role and game state, loads the saved timer,
 * then builds timer unpause mutations.
 */
export class UnpauseGameUseCase
  implements GameActionHandler<EmptyInputData, GameUnpauseBroadcastData>
{
  constructor(
    private readonly socketGameTimerService: SocketGameTimerService,
    private readonly gameService: GameService,
    /** `moderator: true` is the admin panel action: no showman in the loop. */
    private readonly options: { moderator: boolean } = { moderator: false }
  ) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<GameUnpauseBroadcastData>> {
    if (!this.options.moderator) {
      GameValidator.validatePlayerAuthenticated(ctx);

      if (ctx.currentPlayer.role !== PlayerRole.SHOWMAN) {
        throw new ClientError(ClientResponse.ONLY_SHOWMAN_CAN_UNPAUSE);
      }
    }

    const { game } = ctx;

    GameStateValidator.validateGameNotFinished(game);
    GameStateValidator.validateGameStarted(game);

    // Load the saved timer stored under the questionState suffix
    const questionState = game.gameState.questionState;
    const savedTimer = await this.gameService.getTimer(game.id, questionState!);

    const { result, timerMutations } =
      this.socketGameTimerService.buildUnpauseTimerMutations(game, savedTimer);

    const unpauseData: GameUnpauseBroadcastData = { timer: result.data.timer };

    return {
      success: true,
      data: unpauseData,
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
