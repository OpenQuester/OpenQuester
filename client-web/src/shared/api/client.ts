export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";
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
  return (await response.json()) as T;
}

export type User = {
  id: number;
  name?: string;
  username?: string;
  avatar?: string | null;
  isGuest?: boolean;
  permissions?: Array<{ name?: string } | string>;
};

export type GameListItem = {
  id: string;
  title: string;
  isPrivate?: boolean;
  playersCount?: number;
  maxPlayers?: number;
  started?: boolean;
  packageId?: number;
  createdAt?: string;
};

export type PackageSummary = {
  id: number;
  title: string;
  description?: string;
  language?: string;
  author?: { id?: number; username?: string; name?: string } | null;
  roundsCount?: number;
  questionsCount?: number;
  logo?: string | null;
  status?: "draft" | "published";
  updatedAt?: string;
};

export type Paginated<T> =
  | {
      data?: T[];
      items?: T[];
      total?: number;
      count?: number;
      pageInfo?: { total?: number };
    }
  | T[];

export function unwrapPage<T>(page: Paginated<T> | undefined): T[] {
  if (!page) return [];
  if (Array.isArray(page)) return page;
  return page.data ?? page.items ?? [];
}

export function pageTotal<T>(page: Paginated<T> | undefined): number {
  if (!page) return 0;
  if (Array.isArray(page)) return page.length;
  return (
    page.pageInfo?.total ?? page.total ?? page.count ?? unwrapPage(page).length
  );
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
  logout: () => apiRequest<void>("/v1/auth/logout"),
  games: (query = "limit=30&offset=0") =>
    apiRequest<Paginated<GameListItem>>(`/v1/games?${query}`),
  game: (id: string) =>
    apiRequest<GameListItem>(`/v1/games/${encodeURIComponent(id)}`),
  createGame: (body: Record<string, unknown>) =>
    apiRequest<GameListItem>("/v1/games", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  packages: (query = "limit=30&offset=0") =>
    apiRequest<Paginated<PackageSummary>>(`/v1/packages?${query}`),
  package: <T = PackageSummary>(id: string | number) =>
    apiRequest<T>(`/v1/packages/${encodeURIComponent(id)}`),
  createPackage: <T>(body: unknown) =>
    apiRequest<T>("/v1/packages", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePackage: <T>(id: string | number, body: unknown) =>
    apiRequest<T>(`/v1/packages/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  publishPackage: <T>(id: string | number) =>
    apiRequest<T>(`/v1/packages/${encodeURIComponent(id)}/publish`, {
      method: "POST",
    }),
  authenticateSocket: (socketId: string) =>
    apiRequest<void>("/v1/auth/socket", {
      method: "POST",
      body: JSON.stringify({ socketId }),
    }),
};
