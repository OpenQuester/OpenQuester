import { inject, singleton } from "tsyringe";

import {
  DISCORD_ACTIVITY_ENTRY_POINT,
  DISCORD_COMMANDS_UPDATE_SCOPE
} from "domain/constants/discord";
import { DiscordCommandType } from "domain/types/discord/DiscordCommand";
import { DiscordApiClient } from "infrastructure/discord/DiscordApiClient";
import { type Environment } from "shared/config/Environment";
import { DI_TOKENS } from "shared/di/tokens";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

export type EntryPointCheckResult = "disabled" | "exists" | "created" | "failed";

/**
 * Makes sure the Discord application has its Activity "Launch" command.
 * Discord usually creates it when Activities are enabled, but an app can end
 * up without one, and then the Activity can't be started from the launcher.
 */
@singleton()
export class DiscordEntryPointService {
  constructor(
    @inject(DI_TOKENS.Environment) private readonly env: Environment,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger,
    private readonly discordApiClient: DiscordApiClient
  ) {
    //
  }

  /** Never throws: a Discord outage must not stop the server from starting */
  public async ensureEntryPointCommand(): Promise<EntryPointCheckResult> {
    if (!this.env.DISCORD_ACTIVITY_ENABLED) {
      return "disabled";
    }

    try {
      const token = await this.discordApiClient.getAppToken(DISCORD_COMMANDS_UPDATE_SCOPE);
      const commands = await this.discordApiClient.listCommands(token);

      if (commands.some((command) => command.type === DiscordCommandType.PRIMARY_ENTRY_POINT)) {
        return "exists";
      }

      await this.discordApiClient.createCommand(token, DISCORD_ACTIVITY_ENTRY_POINT);

      this.logger.info("Registered the Discord Activity launch command", {
        prefix: LogPrefix.AUTH
      });

      return "created";
    } catch (error) {
      this.logger.warn("Could not check the Discord Activity launch command", {
        prefix: LogPrefix.AUTH,
        error: error instanceof Error ? error.message : String(error)
      });

      return "failed";
    }
  }
}
