import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";

import { api, unwrap } from "@/api/client";
import { API_URL } from "@/api/config";
import type { AuthSettings, User } from "@/api/types";
import { oauthClientId } from "@/features/auth/discord";
import { setUrlMappings, type UrlMapping } from "@/lib/urlMappings";

/** Developer Portal prefix for an API on another host than the app (VITE_API_URL). */
export const API_PREFIX = "/api";

export class ActivityError extends Error {
  constructor(readonly code: "not_configured" | "auth_failed") {
    super(code);
    this.name = "ActivityError";
  }
}

export interface ActivitySession {
  instanceId: string;
  user: User;
}

/** Hosts the Activity must reach through Discord's proxy. */
export function activityUrlMappings(
  settings: AuthSettings,
  apiUrl: string = API_URL,
): UrlMapping[] {
  const mappings = [...(settings.discordActivity?.urlMappings ?? [])];
  if (/^https?:\/\//.test(apiUrl)) {
    const api = new URL(apiUrl);
    mappings.push({ prefix: API_PREFIX, target: api.host + api.pathname.replace(/\/$/, "") });
  }
  return mappings;
}

let started: Promise<ActivitySession> | null = null;

/**
 * Connects to Discord and signs in: the SDK's `authorize` gives a code, the
 * server swaps it for a session (and a token), and `authenticate` hands that
 * token back to Discord. Runs once per page; a failure can be retried.
 */
export function startActivity(settings: AuthSettings): Promise<ActivitySession> {
  started ??= connect(settings).catch((error: unknown) => {
    started = null;
    throw error;
  });
  return started;
}

async function connect(settings: AuthSettings): Promise<ActivitySession> {
  const clientId = oauthClientId(settings, "discord");
  if (!clientId || !settings.discordActivity) throw new ActivityError("not_configured");

  const mappings = activityUrlMappings(settings);
  setUrlMappings(mappings);
  if (mappings.length > 0) patchUrlMappings(mappings, { patchSrcAttributes: true });

  const sdk = new DiscordSDK(clientId, { disableConsoleLogOverride: true });
  await sdk.ready();

  let code: string;
  try {
    ({ code } = await sdk.commands.authorize({
      client_id: clientId,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify"],
    }));
  } catch {
    throw new ActivityError("auth_failed");
  }

  const login = await unwrap(api.POST("/v1/auth/discord/activity", { body: { code } }));
  await sdk.commands.authenticate({ access_token: login.accessToken });

  return { instanceId: sdk.instanceId, user: login.user };
}

/** Tests only. */
export function resetActivityForTests(): void {
  started = null;
}
