import { GameService } from "application/services/game/GameService";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import {
  EmptyInputData,
  GameUnpauseBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for unpausing a game.
 */
export class UnpauseGameActionHandler
  implements GameActionHandler<EmptyInputData, GameUnpauseBroadcastData>
{
  constructor(
    private readonly validationService: SocketGameValidationService,
    private readonly socketGameTimerService: SocketGameTimerService,
    private readonly gameService: GameService
  ) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<GameUnpauseBroadcastData>> {
    const { game, currentPlayer } = ctx;

    this.validationService.validateGameUnpause(currentPlayer, game);

    // The active timer key (timer:{gameId}) is already in ctx.timer, but for
    // unpause we need the saved timer stored under the questionState suffix.
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
