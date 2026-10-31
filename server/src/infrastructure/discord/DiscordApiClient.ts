import { inject, singleton } from "tsyringe";

import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import {
  DISCORD_REQUEST_TIMEOUT_MS,
  DISCORD_STARTUP_REQUEST_TIMEOUT_MS
} from "domain/constants/discord";
import { type DiscordCommand, type DiscordCommandInput } from "domain/types/discord/DiscordCommand";
import { type DiscordToken } from "domain/types/discord/DiscordToken";
import { type Environment } from "shared/config/Environment";
import { DI_TOKENS } from "shared/di/tokens";

/** `GET /applications/{id}/activity-instances/{instanceId}`, the fields we read */
interface DiscordActivityInstanceResponse {
  users?: string[];
}

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
      }),
      signal: AbortSignal.timeout(DISCORD_REQUEST_TIMEOUT_MS)
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

  /**
   * An app token from the client-credentials grant, for calls the app makes
   * as itself (no user involved).
   */
  public async getAppToken(scope: string): Promise<string> {
    const response = await fetch(`${this.env.DISCORD_API_URL}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.env.DISCORD_CLIENT_ID,
        client_secret: this.env.DISCORD_CLIENT_SECRET,
        grant_type: "client_credentials",
        scope
      }),
      signal: AbortSignal.timeout(DISCORD_STARTUP_REQUEST_TIMEOUT_MS)
    });
    const body = (await response.json().catch(() => ({}))) as DiscordTokenResponse;

    if (!response.ok || typeof body.access_token !== "string") {
      throw new Error(`Discord app token refused: ${body.error ?? `HTTP ${response.status}`}`);
    }

    return body.access_token;
  }

  /** The application's global commands */
  public async listCommands(appToken: string): Promise<DiscordCommand[]> {
    const response = await fetch(this._commandsUrl(), {
      headers: { authorization: `Bearer ${appToken}` },
      signal: AbortSignal.timeout(DISCORD_STARTUP_REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`Discord commands list failed: HTTP ${response.status}`);
    }

    return (await response.json()) as DiscordCommand[];
  }

  public async createCommand(appToken: string, command: DiscordCommandInput): Promise<void> {
    const response = await fetch(this._commandsUrl(), {
      method: "POST",
      headers: { authorization: `Bearer ${appToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(DISCORD_STARTUP_REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(
        `Discord command create failed: HTTP ${response.status} ${await response.text()}`
      );
    }
  }

  /** Raw body of `GET /users/@me` for the given Authorization header value */
  public async getCurrentUser(authorization: string): Promise<string> {
    const response = await fetch(`${this.env.DISCORD_API_URL}/users/@me`, {
      headers: { authorization },
      signal: AbortSignal.timeout(DISCORD_REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new ClientError(ClientResponse.DISCORD_TOKEN_REJECTED, HttpStatus.UNAUTHORIZED);
    }

    return response.text();
  }

  /**
   * Discord user ids in a running Activity instance, or `null` when Discord
   * knows no such instance. Needs the application's bot token.
   */
  public async getActivityInstanceUsers(instanceId: string): Promise<string[] | null> {
    const url =
      `${this.env.DISCORD_API_URL}/applications/${this.env.DISCORD_CLIENT_ID}` +
      `/activity-instances/${encodeURIComponent(instanceId)}`;
    const response = await fetch(url, {
      headers: { authorization: `Bot ${this.env.DISCORD_BOT_TOKEN}` },
      signal: AbortSignal.timeout(DISCORD_REQUEST_TIMEOUT_MS)
    });

    if (response.status === HttpStatus.NOT_FOUND) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Discord activity instance lookup failed: HTTP ${response.status}`);
    }

    const body = (await response.json()) as DiscordActivityInstanceResponse;

    return body.users ?? [];
  }

  private _commandsUrl(): string {
    return `${this.env.DISCORD_API_URL}/applications/${this.env.DISCORD_CLIENT_ID}/commands`;
  }
}
