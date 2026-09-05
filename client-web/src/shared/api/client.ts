import type { components } from "./schema";

const configuredApiBaseUrl = import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL = configuredApiBaseUrl?.replace(/\/$/, "") ?? "";
export const SESSION_EXPIRED_EVENT = "openquester:session-expired";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    if (
      response.status === 401 &&
      path !== "/v1/me" &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new ApiError(body?.message ?? response.statusText, response.status);
  }
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(
      "The web client received an invalid API response. Check the configured API URL.",
      502,
    );
  }
  return (await response.json()) as T;
}

// These come from openapi/schema.json via `npm run generate:api`. Re-declaring
// them by hand is what let the game list read `playersCount` and `started`,
// neither of which the API has ever sent.
export type User = components["schemas"]["ResponseUser"];
export type GameListItem = components["schemas"]["GameListItem"];
export type PackageSummary = components["schemas"]["PackageListItem"];
export type PackageDetail = components["schemas"]["OqPackage"];
export type PackageUploadResponse =
  components["schemas"]["PackageUploadResponse"];

export type Paginated<T> = { data: T[]; pageInfo: { total: number } };

export function unwrapPage<T>(page: Paginated<T> | undefined): T[] {
  return page?.data ?? [];
}

export function pageTotal<T>(page: Paginated<T> | undefined): number {
  return page?.pageInfo?.total ?? page?.data?.length ?? 0;
}

/** Players actually seated in a game, which the list endpoint sends as rows. */
export function seatedPlayerCount(game: GameListItem): number {
  return game.players.filter((player) => player.role === "player").length;
}

export function isGameStarted(game: GameListItem): boolean {
  return Boolean(game.startedAt) && !game.finishedAt;
}

export type GameQuery = { limit?: number; offset?: number };

export type PackageQuery = {
  limit?: number;
  offset?: number;
  sortBy?: components["schemas"]["PackagesSortBy"];
  order?: "asc" | "desc";
  title?: string;
  language?: string;
  status?: components["schemas"]["PackageStatus"];
  mine?: boolean;
};

/** Drops empty values so an unset filter never reaches the API as `&title=`. */
function toQuery(
  params: Record<string, string | number | boolean | undefined>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  return search.toString();
}

export const api = {
  me: () => apiRequest<User>("/v1/me"),
  updateMe: (body: Partial<User>) =>
    apiRequest<User>("/v1/me", { method: "PATCH", body: JSON.stringify(body) }),
  guestLogin: (name: string) =>
    apiRequest<User>("/v1/auth/guest", {
      method: "POST",
      body: JSON.stringify({ username: name, name }),
    }),
  fileUploadUrl: (filename: string) =>
    apiRequest<{ url: string }>(`/v1/files/${encodeURIComponent(filename)}`, {
      method: "POST",
    }),
  logout: () => apiRequest<void>("/v1/auth/logout", { method: "POST" }),
  games: ({ limit = 30, offset = 0 }: GameQuery = {}) =>
    apiRequest<Paginated<GameListItem>>(
      `/v1/games?${toQuery({ limit, offset })}`,
    ),
  game: (id: string) =>
    apiRequest<GameListItem>(`/v1/games/${encodeURIComponent(id)}`),
  createGame: (body: Record<string, unknown>) =>
    apiRequest<GameListItem>("/v1/games", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  packages: ({ limit = 30, offset = 0, ...rest }: PackageQuery = {}) =>
    apiRequest<Paginated<PackageSummary>>(
      `/v1/packages?${toQuery({ limit, offset, ...rest })}`,
    ),
  package: <T = PackageDetail>(id: string | number) =>
    apiRequest<T>(`/v1/packages/${encodeURIComponent(id)}`),
  createPackage: (body: unknown) =>
    apiRequest<PackageUploadResponse>("/v1/packages", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePackage: (id: string | number, body: unknown) =>
    apiRequest<PackageUploadResponse>(
      `/v1/packages/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  publishPackage: (id: string | number) =>
    apiRequest<PackageDetail>(
      `/v1/packages/${encodeURIComponent(id)}/publish`,
      { method: "POST" },
    ),
  authenticateSocket: (socketId: string) =>
    apiRequest<void>("/v1/auth/socket", {
      method: "POST",
      body: JSON.stringify({ socketId }),
    }),
};
