import { inject, singleton } from "tsyringe";

import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { type DiscordToken } from "domain/types/discord/DiscordToken";
import { type Environment } from "shared/config/Environment";
import { DI_TOKENS } from "shared/di/tokens";

/** Token endpoint answer: a token, or an OAuth2 error */
interface DiscordTokenResponse extends Partial<DiscordToken> {
  error?: string;
}

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

    const body = (await response.json().catch(() => ({}))) as DiscordTokenResponse;

    // Discord's OAuth2 error says what to fix: `invalid_client` is a wrong
    // client id or secret, `invalid_grant` a used, expired or foreign code
    if (!response.ok || typeof body.access_token !== "string" || body.access_token.length < 1) {
      throw new ClientError(ClientResponse.DISCORD_CODE_EXCHANGE_FAILED, HttpStatus.UNAUTHORIZED, {
        reason: body.error ?? `HTTP ${response.status}`
      });
    }

    return {
      access_token: body.access_token,
      token_type: body.token_type ?? "Bearer",
      expires_in: body.expires_in ?? 0,
      scope: body.scope ?? ""
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
