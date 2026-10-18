import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { type AddressInfo } from "node:net";
import { text } from "node:stream/consumers";

export interface FakeDiscordAccount {
  clientId: string;
  clientSecret: string;
  /** The one code the token endpoint accepts */
  code: string;
  accessToken: string;
  user: Record<string, unknown>;
}

/**
 * Answers Discord's OAuth2 token exchange and `GET /users/@me` like
 * discord.com does, for DISCORD_API_URL in tests.
 */
export class FakeDiscordApi {
  private constructor(
    private readonly server: Server,
    public readonly url: string,
    /** The application's commands, as Discord would store them */
    public readonly commands: Record<string, unknown>[]
  ) {
    //
  }

  public static async start(account: FakeDiscordAccount): Promise<FakeDiscordApi> {
    const commands: Record<string, unknown>[] = [];
    const server = createServer((req, res) => {
      void FakeDiscordApi.handle(account, commands, req, res);
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const { port } = server.address() as AddressInfo;

    return new FakeDiscordApi(server, `http://127.0.0.1:${port}`, commands);
  }

  public async stop(): Promise<void> {
    this.server.close();
    await once(this.server, "close");
  }

  private static async handle(
    account: FakeDiscordAccount,
    commands: Record<string, unknown>[],
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const body = await text(req);
    const reply = (status: number, data: unknown): void => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };

    const appToken = `app-token-${account.clientId}`;
    const commandsPath = `/applications/${account.clientId}/commands`;

    if (req.method === "POST" && req.url === "/oauth2/token") {
      const form = new URLSearchParams(body);

      if (form.get("grant_type") === "client_credentials") {
        const allowed =
          form.get("client_id") === account.clientId &&
          form.get("client_secret") === account.clientSecret &&
          form.get("scope") === "applications.commands.update";

        return allowed
          ? reply(200, { access_token: appToken, token_type: "Bearer", scope: form.get("scope") })
          : reply(401, { error: "invalid_client" });
      }

      const valid =
        form.get("client_id") === account.clientId &&
        form.get("client_secret") === account.clientSecret &&
        form.get("grant_type") === "authorization_code" &&
        form.get("code") === account.code;

      return valid
        ? reply(200, {
            access_token: account.accessToken,
            token_type: "Bearer",
            expires_in: 604800,
            scope: "identify"
          })
        : reply(400, { error: "invalid_grant" });
    }

    if (req.method === "GET" && req.url === "/users/@me") {
      return req.headers.authorization === `Bearer ${account.accessToken}`
        ? reply(200, account.user)
        : reply(401, { message: "401: Unauthorized", code: 0 });
    }

    if (req.url === commandsPath && req.headers.authorization === `Bearer ${appToken}`) {
      if (req.method === "GET") {
        return reply(200, commands);
      }

      if (req.method === "POST") {
        const command = { id: String(commands.length + 1), ...JSON.parse(body) };
        commands.push(command);

        return reply(201, command);
      }
    }

    reply(404, { message: "404: Not Found" });
  }
}
