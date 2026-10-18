# Discord Activity

OpenQuester's web app (`web/`) runs inside a Discord voice channel as an
Activity. Everyone in the call opens the same lobby; nobody shares links or
signs in separately.

## Flow

1. Discord opens the app on `https://{clientId}.discordsays.com/?frame_id=…&instance_id=…`.
   `web/src/features/discord/launch.ts` sees the launch query (or the
   discordsays.com host), and the router shows `/discord` instead of the home
   page. Everything else stays the website; the Embedded App SDK is a lazy
   chunk loaded only on `/discord`.
2. `startActivity` (`features/discord/activity.ts`) reads `GET /v1/auth/settings`.
   `discordActivity` is `null` unless the server has both `DISCORD_CLIENT_ID`
   and `DISCORD_CLIENT_SECRET`; the page then says the Activity isn't set up.
3. URL mappings: the SDK's `patchUrlMappings` sends fetch, WebSocket, XHR and
   `src` attributes for the media host (`/media`) and, when `VITE_API_URL` is
   absolute, the API host (`/api`) through Discord's proxy. Media preloaded
   off-document goes through `mapUrl` (`lib/urlMappings.ts`).
4. Sign-in: SDK `authorize` (scope `identify`) gives a code →
   `POST /v1/auth/discord/activity { code }` swaps it with the client secret,
   signs the Discord user in through the same path as website Discord login
   (matched by `discord_id`), and returns `{ user, accessToken }` → SDK
   `authenticate`.
5. The session cookie for that login is host-only with
   `SameSite=None; Secure; Partitioned`, the only kind Chrome keeps for an
   iframe on discordsays.com inside discord.com. `session.discordActivity`
   stops the per-request cookie domain (`API_DOMAIN`) from coming back.
6. Lobby: `GET /v1/discord/activity/instances/{instanceId}/game` returns the
   call's game and password, or `game: null`. With no game, everyone sees a
   package list; whoever picks first calls
   `POST …/instances/{instanceId}/game` and hosts (`created: true`). The
   others poll every 3 s and join as players, or spectators when the seats are
   full. The game is always private; the password comes with the lobby, so
   only people who know the instance id (people in the call) can join.
   A Redis lock makes concurrent launches share one game; a loser gets 409
   `discord_activity_game_busy` and picks up the game on its next poll. A
   finished or deleted game frees the call for a new one.
   The lobby screen also lists other open games and takes a game code or link,
   so people can go back into the call's game after leaving it, or join any
   other game (those ask for a password or role like on the website).
7. Socket.IO is WebSocket-only (`game/connection.ts`), which Discord's proxy
   supports.

## Server pieces

- `AuthRestApiController`: `POST /v1/auth/discord/activity`, settings field.
- `DiscordAuthService` / `DiscordApiClient`: code exchange and `/users/@me`
  (`DISCORD_API_URL` lets tests answer for Discord).
- `DiscordActivityService` + `DiscordActivityRestApiController`: lobby per instance.
- `MiddlewareController`: CORS allows `https://{clientId}.discordsays.com`;
  CSP `frame-ancestors` allows Discord and `X-Frame-Options` is off while the
  Activity is enabled.
- The Cloudflare Pages proxy (`web/functions/_proxy.ts`) lets that origin
  through when its `DISCORD_CLIENT_ID` variable is set.

## Developer Portal (manual)

Use the same application as "Log in with Discord" so `discord_id` matches.

1. Installation → Installation Contexts: enable User Install and Guild Install.
2. OAuth2 → Redirects: add `https://127.0.0.1` (placeholder; the SDK handles it).
   It must be the **first** redirect: the Activity's `authorize` uses the first
   one, and a custom scheme there (the Flutter app's `openquester://`) fails with
   `Redirect URI 'openquester://' is not supported by client`.
3. Activities → URL Mappings:
   - `/` → the web app host (Pages, or the API host when it serves `WEB_APP_DIR`).
     That host already forwards `/v1` and `/socket.io` to the API.
   - `/media` → the S3/CDN host from `GET /v1/auth/settings` (`discordActivity.urlMappings`).
   - `/api` → the API host, only if the build sets an absolute `VITE_API_URL`.
4. Activities → Art Assets: upload `assets/discord-activity/cover.png`
   (and `icon.png` as the app icon if needed).
5. Activities → Settings: Enable Activities.
6. Server: set `DISCORD_CLIENT_SECRET`. Pages: set the `DISCORD_CLIENT_ID` variable.

The server registers the Activity's "Launch" entry point command at startup
when the application has none (`DiscordEntryPointService`, using a
client-credentials token with `applications.commands.update`; it logs a
warning and carries on when Discord refuses). Discord normally makes that
command when Activities are first enabled, but an app can end up without one,
and the portal then says it "has no commands registered to launch them".
To register it by hand instead, use the bot token
(Developer Portal → Bot → Reset Token):

```bash
curl -X POST "https://discord.com/api/v10/applications/$DISCORD_CLIENT_ID/commands" \
  -H "Authorization: Bot $DISCORD_BOT_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"launch","description":"Play OpenQuester in this voice channel","type":4,"handler":2,"integration_types":[0,1],"contexts":[0,1,2]}'
```

`type: 4` is a primary entry point command and `handler: 2` lets Discord
launch the Activity itself, so no bot code is needed.

Until the app is distributed, only members of its developer team can launch it.

## Local development

Run the server and `npm run dev` in `web/`, tunnel the dev server
(`cloudflared tunnel --url http://localhost:5173`), point the `/` mapping at
the tunnel host, and launch from a voice channel. Vite proxies `/v1` and
`/socket.io` to the server.

## Debugging

- The loading screen names the startup step; a step that hangs fails with the
  step's name (`handshake` 15 s, `authorize` 120 s, `sign_in` 20 s,
  `authenticate` 15 s) and the error detail below it.
- Console lines start with `[OpenQuester Activity]` and include the client id
  and launch query. The SDK forwards the page's console to Discord's console.
- Easiest console: run Discord in a browser (discord.com/app), launch the
  Activity, open DevTools and pick the `discordsays.com` frame in the console's
  context menu. The desktop app needs Developer Mode plus DevTools enabled in
  its `settings.json`.
- `handshake` hangs: `DISCORD_CLIENT_ID` on the server isn't the Activity's
  application id, or the page lost `frame_id` / `instance_id` before the SDK
  started.
- `authorize` fails: the user closed the consent dialog, or the first OAuth2
  redirect isn't `https://127.0.0.1`.
- `sign_in` fails: wrong `DISCORD_CLIENT_SECRET`, or the request never reached
  the API (check the `/` mapping and, on Pages, the `DISCORD_CLIENT_ID` variable).

## Not done yet

- Small-screen / picture-in-picture layout of the game screen.
- Invite button (`openInviteDialog`), rich presence (#128), results posted by a bot (#471).
- Checking signed S3 URLs and video range requests through the proxy on a real deployment.
