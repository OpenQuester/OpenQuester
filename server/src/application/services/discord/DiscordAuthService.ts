import { inject, singleton } from "tsyringe";

import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { type DiscordToken } from "domain/types/discord/DiscordToken";
import { DiscordApiClient } from "infrastructure/discord/DiscordApiClient";
import { type Environment } from "shared/config/Environment";
import { DI_TOKENS } from "shared/di/tokens";

/** Discord sign-in calls that need the server (the client secret, or Discord's API) */
@singleton()
export class DiscordAuthService {
  constructor(
    @inject(DI_TOKENS.Environment) private readonly env: Environment,
    private readonly discordApiClient: DiscordApiClient
  ) {
    //
  }

  /** Swaps the Activity's `authorize` code for a Discord access token */
  public async exchangeActivityCode(code: string): Promise<DiscordToken> {
    if (!this.env.DISCORD_ACTIVITY_ENABLED) {
      throw new ClientError(ClientResponse.DISCORD_ACTIVITY_DISABLED, HttpStatus.NOT_FOUND);
    }

    return this.discordApiClient.exchangeCode(code);
  }

  /** Raw `GET /users/@me` body for an Authorization header value */
  public async getCurrentUser(authorization: string): Promise<string> {
    return this.discordApiClient.getCurrentUser(authorization);
  }
}
