import { inject, singleton } from "tsyringe";

import { GameService } from "application/services/game/GameService";
import { SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { ServerError } from "domain/errors/ServerError";
import { Environment } from "shared/config/Environment";
import { DI_TOKENS } from "shared/di/tokens";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import {
  type SingleInstanceGameRecoveryResult,
  type SingleInstanceRestartRecoveryResult,
  type SingleInstanceSocketSessionCleanupResult
} from "domain/types/recovery/SingleInstanceRestartRecoveryResult";

@singleton()
export class SingleInstanceRestartRecoveryService {
  constructor(
    @inject(DI_TOKENS.Environment) private readonly env: Environment,
    private readonly gameService: GameService,
    private readonly socketUserDataService: SocketUserDataService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  public async recoverIfEnabled(): Promise<SingleInstanceRestartRecoveryResult> {
    if (!this.env.STARTUP_RECOVERY_ENABLED) {
      this.logger.info(
        "single-instance restart recovery disabled; skipping global game, timer, and socket-session recovery",
        { prefix: LogPrefix.SERVE_API }
      );
      return { status: "disabled" };
    }

    this.logger.warn(
      "STARTUP_RECOVERY_ENABLED=true: running single-instance restart recovery. " +
        "This globally affects all games, timers, and socket sessions and is invalid " +
        "for multiple live server instances.",
      { prefix: LogPrefix.SERVE_API }
    );

    const gameRecovery = await this._runGameRecovery();
    const socketSessionCleanup = await this._runSocketSessionCleanup();

    this.logger.info("single-instance restart recovery completed", {
      prefix: LogPrefix.SERVE_API,
      recoveredGames: gameRecovery.recoveredGames,
      recoveredTimers: gameRecovery.recoveredTimers,
      removedSocketSessions: socketSessionCleanup.removedSocketSessions,
      removedUserSocketLookups: socketSessionCleanup.removedUserSocketLookups
    });

    return {
      status: "completed",
      gameRecovery,
      socketSessionCleanup
    };
  }

  private async _runGameRecovery(): Promise<SingleInstanceGameRecoveryResult> {
    try {
      return await this.gameService.recoverAllGamesAfterSingleInstanceRestart();
    } catch (error) {
      throw new ServerError("single-instance restart game recovery failed", undefined, undefined, {
        cause: error
      });
    }
  }

  private async _runSocketSessionCleanup(): Promise<SingleInstanceSocketSessionCleanupResult> {
    try {
      return await this.socketUserDataService.clearAllSocketSessionsAfterSingleInstanceRestart();
    } catch (error) {
      throw new ServerError(
        "single-instance restart socket-session cleanup failed",
        undefined,
        undefined,
        { cause: error }
      );
    }
  }
}
