import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";

import { api, unwrap } from "@/api/client";
import { API_URL } from "@/api/config";
import type { AuthSettings, User } from "@/api/types";
import { oauthClientId } from "@/features/auth/discord";
import { setUrlMappings, type UrlMapping } from "@/lib/urlMappings";

import { setPresenceSink } from "./presence";

/** Developer Portal prefix for an API on another host than the app (VITE_API_URL). */
export const API_PREFIX = "/api";

/** Startup steps, in order; the loading screen names the current one. */
export type ActivityStep = "handshake" | "authorize" | "sign_in" | "authenticate";

/**
 * How long each step may take before the page gives up and says which one hung.
 * `authorize` waits for the person to accept Discord's consent dialog.
 */
export const STEP_TIMEOUT_MS: Record<ActivityStep, number> = {
  handshake: 15_000,
  authorize: 120_000,
  sign_in: 20_000,
  authenticate: 15_000,
};

export type ActivityErrorCode = "not_configured" | "auth_failed" | "timeout";

export class ActivityError extends Error {
  constructor(
    readonly code: ActivityErrorCode,
    readonly step: ActivityStep | null = null,
    readonly detail: string | null = null,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "ActivityError";
  }
}

const LOG = "[OpenQuester Activity]";

/** Runs one startup step: logs it, reports it, and turns a hang or failure into an ActivityError. */
async function step<T>(
  name: ActivityStep,
  onStep: (step: ActivityStep) => void,
  run: () => Promise<T>,
): Promise<T> {
  console.info(LOG, name);
  onStep(name);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ActivityError("timeout", name)), STEP_TIMEOUT_MS[name]);
  });
  try {
    return await Promise.race([run(), timeout]);
  } catch (error) {
    console.error(LOG, name, "failed", error);
    if (error instanceof ActivityError) throw error;
    throw new ActivityError("auth_failed", name, describe(error));
  } finally {
    clearTimeout(timer);
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
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
export function startActivity(
  settings: AuthSettings,
  onStep: (step: ActivityStep) => void = () => {},
): Promise<ActivitySession> {
  started ??= connect(settings, onStep).catch((error: unknown) => {
    started = null;
    throw error;
  });
  return started;
}

async function connect(
  settings: AuthSettings,
  onStep: (step: ActivityStep) => void,
): Promise<ActivitySession> {
  const clientId = oauthClientId(settings, "discord");
  if (!clientId || !settings.discordActivity) throw new ActivityError("not_configured");
  console.info(LOG, "client", clientId, "query", window.location.search);

  const mappings = activityUrlMappings(settings);
  setUrlMappings(mappings);
  if (mappings.length > 0) patchUrlMappings(mappings, { patchSrcAttributes: true });

  // Console output is forwarded to Discord's own console, which helps debugging there
  const sdk = new DiscordSDK(clientId);
  // Hangs when this isn't the Activity's application id or Discord didn't open the page
  await step("handshake", onStep, () => sdk.ready());

  const { code } = await step("authorize", onStep, () =>
    sdk.commands.authorize({
      client_id: clientId,
      response_type: "code",
      state: "",
      prompt: "none",
      // rpc.activities.write: the game shows in the player's Discord status
      scope: ["identify", "rpc.activities.write"],
    }),
  );

  const login = await step("sign_in", onStep, () =>
    unwrap(api.POST("/v1/auth/discord/activity", { body: { code } })),
  );
  await step("authenticate", onStep, () =>
    sdk.commands.authenticate({ access_token: login.accessToken }),
  );

  setPresenceSink((presence) =>
    sdk.commands.setActivity({
      activity: {
        type: 0,
        details: presence.details,
        state: presence.state,
        ...(presence.party ? { party: presence.party } : {}),
        ...(presence.startedAt ? { timestamps: { start: presence.startedAt } } : {}),
      },
    }),
  );

  return { instanceId: sdk.instanceId, user: login.user };
}

/** Tests only. */
export function resetActivityForTests(): void {
  started = null;
}
