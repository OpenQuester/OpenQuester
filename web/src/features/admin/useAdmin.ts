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
