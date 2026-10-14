import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import type { User } from "@/api/types";

type S = components["schemas"];
export type PermissionName = S["PermissionName"];
export type UserStatus = S["UserStatus"];
export type UserType = S["UserType"];

export function can(user: User | null | undefined, permission: PermissionName): boolean {
  return !!user?.permissions?.some((p) => p.name === permission);
}

export const ADMIN_PAGE_SIZE = 20;

export function useDashboard(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    enabled,
    queryFn: () => unwrap(api.GET("/v1/admin/api/dashboard")),
  });
}

export function useSystemHealth(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "health"],
    enabled,
    queryFn: async () => {
      const [health, ping] = await Promise.all([
        unwrap(api.GET("/v1/admin/api/system/health")),
        unwrap(api.GET("/v1/admin/api/system/ping")),
      ]);
      return { health, ping };
    },
  });
}

export interface UserQuery {
  search: string;
  status: UserStatus | "";
  userType: UserType;
  page: number;
}

export function useAdminUsers(q: UserQuery, enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "users", q],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () =>
      unwrap(
        api.GET("/v1/admin/api/users", {
          params: {
            query: {
              limit: ADMIN_PAGE_SIZE,
              offset: q.page * ADMIN_PAGE_SIZE,
              sortBy: "created_at",
              order: "desc",
              userType: q.userType,
              ...(q.search.trim() ? { search: q.search.trim() } : {}),
              ...(q.status ? { status: q.status } : {}),
            },
          },
        }),
      ),
  });
}

export type UserAction =
  | { kind: "ban" | "unban" | "unmute" | "delete" | "restore"; id: number }
  | { kind: "mute"; id: number; hours: number };

/** One moderation action; refreshes the lists afterwards. */
export function useUserAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: UserAction) => {
      const path = { params: { path: { id: a.id } } };
      switch (a.kind) {
        case "ban":
          return unwrap(api.POST("/v1/admin/api/users/{id}/ban", path));
        case "unban":
          return unwrap(api.POST("/v1/admin/api/users/{id}/unban", path));
        case "mute":
          return unwrap(
            api.POST("/v1/admin/api/users/{id}/mute", {
              ...path,
              body: { mutedUntil: new Date(Date.now() + a.hours * 3_600_000).toISOString() },
            }),
          );
        case "unmute":
          return unwrap(api.POST("/v1/admin/api/users/{id}/unmute", path));
        case "delete":
          return unwrap(api.DELETE("/v1/admin/api/users/{id}", path));
        case "restore":
          return unwrap(api.POST("/v1/admin/api/users/restore/{id}", path));
      }
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export type StaffRole = S["StaffRole"];
export type AdminGameDetails = S["AdminGameDetails"];
export type AdminGamePlayer = S["AdminGamePlayer"];

/** Admin when they can manage permissions, moderator with panel access; mirrors the server. */
export function staffRoleOf(user: Pick<User, "permissions"> | null | undefined): StaffRole {
  if (can(user as User, "manage_permissions")) return "admin";
  if (can(user as User, "admin_panel_access")) return "moderator";
  return "user";
}

export function useRoles(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "roles"],
    enabled,
    staleTime: Infinity,
    queryFn: () => unwrap(api.GET("/v1/admin/api/roles")),
  });
}

export function useSetPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { id: number; permissions: PermissionName[] }) =>
      unwrap(
        api.PUT("/v1/admin/api/users/{id}/permissions", {
          params: { path: { id: a.id } },
          body: { permissions: a.permissions },
        }),
      ),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useAdminGames(search: string, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "games", search, page],
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: 10_000,
    queryFn: () =>
      unwrap(
        api.GET("/v1/admin/api/games", {
          params: {
            query: {
              limit: ADMIN_PAGE_SIZE,
              offset: page * ADMIN_PAGE_SIZE,
              ...(search.trim() ? { search: search.trim() } : {}),
            },
          },
        }),
      ),
  });
}

/** One game with everyone in it; polls while it is open on screen. */
export function useAdminGame(gameId: string | null) {
  return useQuery({
    queryKey: ["admin", "game", gameId],
    enabled: !!gameId,
    refetchInterval: 3000,
    retry: false,
    queryFn: () =>
      unwrap(api.GET("/v1/admin/api/games/{gameId}", { params: { path: { gameId: gameId! } } })),
  });
}

export type GameAction =
  | { kind: "kick"; gameId: string; playerId: number }
  | { kind: "pause" | "unpause" | "close"; gameId: string };

export function useGameAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: GameAction) => {
      const game = { params: { path: { gameId: a.gameId } } };
      switch (a.kind) {
        case "kick":
          return unwrap(
            api.POST("/v1/admin/api/games/{gameId}/players/{playerId}/kick", {
              params: { path: { gameId: a.gameId, playerId: a.playerId } },
            }),
          );
        case "pause":
          return unwrap(api.POST("/v1/admin/api/games/{gameId}/pause", game));
        case "unpause":
          return unwrap(api.POST("/v1/admin/api/games/{gameId}/unpause", game));
        case "close":
          return unwrap(api.DELETE("/v1/admin/api/games/{gameId}", game));
      }
    },
    onSettled: (_d, _e, a) => {
      void qc.invalidateQueries({ queryKey: ["admin", "games"] });
      if (a.kind === "close") qc.removeQueries({ queryKey: ["admin", "game", a.gameId] });
      else void qc.invalidateQueries({ queryKey: ["admin", "game", a.gameId] });
    },
  });
}
