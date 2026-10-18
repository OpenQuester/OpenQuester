import { inject, singleton } from "tsyringe";

import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { type DiscordToken } from "domain/types/discord/DiscordToken";
import { type Environment } from "shared/config/Environment";
import { DI_TOKENS } from "shared/di/tokens";

/**
 * Calls Discord's REST API. The base URL comes from DISCORD_API_URL so tests
 * can answer for Discord.
 */
@singleton()
export class DiscordApiClient {
  constructor(@inject(DI_TOKENS.Environment) private readonly env: Environment) {
    //
  }

  /**
   * Exchanges the code an Activity got from the Embedded App SDK's `authorize`.
   * Needs the client secret, so it can only run on the server.
   */
  public async exchangeCode(code: string): Promise<DiscordToken> {
    const response = await fetch(`${this.env.DISCORD_API_URL}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.env.DISCORD_CLIENT_ID,
        client_secret: this.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code
      })
    });

    if (!response.ok) {
      throw new ClientError(ClientResponse.DISCORD_CODE_EXCHANGE_FAILED, HttpStatus.UNAUTHORIZED);
    }

    const token = (await response.json()) as Partial<DiscordToken>;

    if (typeof token.access_token !== "string" || token.access_token.length < 1) {
      throw new ClientError(ClientResponse.DISCORD_CODE_EXCHANGE_FAILED, HttpStatus.UNAUTHORIZED);
    }

    return {
      access_token: token.access_token,
      token_type: token.token_type ?? "Bearer",
      expires_in: token.expires_in ?? 0,
      scope: token.scope ?? ""
    };
  }

  /** Raw body of `GET /users/@me` for the given Authorization header value */
  public async getCurrentUser(authorization: string): Promise<string> {
    const response = await fetch(`${this.env.DISCORD_API_URL}/users/@me`, {
      headers: { authorization }
    });

    return response.text();
  }
}
