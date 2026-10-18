/**
 * Whether this page runs as a Discord Activity. Discord opens the app on
 * `{clientId}.discordsays.com` with `frame_id` and `instance_id` in the query;
 * the SDK and everything Activity-only load lazily so the website doesn't pay
 * for them.
 */
export const ACTIVITY_PATH = "/discord";

let activity: boolean | null = null;

export function detectDiscordActivity(location: Pick<Location, "hostname" | "search">): boolean {
  const params = new URLSearchParams(location.search);
  return (
    (params.has("frame_id") && params.has("instance_id")) ||
    location.hostname.endsWith(".discordsays.com")
  );
}

export function isDiscordActivity(): boolean {
  activity ??= detectDiscordActivity(window.location);
  return activity;
}

/**
 * Sends a Discord launch to the Activity screen. The query stays: the SDK
 * reads `frame_id` and `instance_id` from it when it starts.
 */
export function routeDiscordLaunch(): void {
  if (!isDiscordActivity() || window.location.pathname !== "/") return;
  window.history.replaceState(window.history.state, "", ACTIVITY_PATH + window.location.search);
}

/** Tests only. */
export function resetDiscordActivityForTests(): void {
  activity = null;
}
