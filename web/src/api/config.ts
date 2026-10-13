/**
 * Where the API lives. Empty means same origin: the dev/preview server proxies
 * /v1 and /socket.io, and production can sit behind the same host.
 */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export const DISCORD_CLIENT_ID: string = import.meta.env.VITE_DISCORD_CLIENT_ID ?? "";

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}
