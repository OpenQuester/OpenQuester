import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "@/api/client";
import type { AuthSettings, OauthProvider } from "@/api/types";
import { safeStorage } from "@/lib/storage";

const VERIFIER_KEY = "oq.discord.verifier";
const RETURN_KEY = "oq.discord.return";

/** Sign-in settings come from the server, so one build works for every deployment. */
export const authSettingsQuery = {
  queryKey: ["auth-settings"] as const,
  queryFn: (): Promise<AuthSettings> => unwrap(api.GET("/v1/auth/settings")),
  staleTime: Infinity,
};

/** A provider's client id from the settings, or null when the server hasn't set it up. */
export function oauthClientId(
  settings: AuthSettings | undefined,
  provider: OauthProvider,
): string | null {
  return settings?.oauthProviders.find((p) => p.provider === provider)?.clientId || null;
}

/** The Discord application id, or null while loading or when Discord sign-in is off. */
export function useDiscordClientId(): string | null {
  const { data } = useQuery(authSettingsQuery);
  return oauthClientId(data, "discord");
}

function redirectUri(): string {
  return `${window.location.origin}/auth/discord`;
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Starts the Discord authorization-code + PKCE flow (same as the Flutter app). */
export async function startDiscordLogin(clientId: string, returnTo: string): Promise<void> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
  );
  safeStorage.set(VERIFIER_KEY, verifier);
  safeStorage.set(RETURN_KEY, returnTo);
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("scope", "identify email");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  window.location.assign(url.toString());
}

/** Finishes the flow on /auth/discord and returns where to go next. */
export async function finishDiscordLogin(clientId: string, code: string): Promise<string> {
  const verifier = safeStorage.get(VERIFIER_KEY);
  if (!verifier) throw new Error("missing_verifier");
  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error("discord_token_failed");
  const token = (await res.json()) as { access_token: string; token_type?: string };
  await unwrap(
    api.POST("/v1/auth/oauth2", {
      body: {
        token: token.access_token,
        tokenSchema: token.token_type ?? "Bearer",
        oauthProvider: "discord",
      },
    }),
  );
  safeStorage.remove(VERIFIER_KEY);
  const back = safeStorage.get(RETURN_KEY) ?? "/";
  safeStorage.remove(RETURN_KEY);
  return back;
}
