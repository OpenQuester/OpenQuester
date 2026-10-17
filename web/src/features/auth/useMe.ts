import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError, unwrap } from "@/api/client";
import type { User } from "@/api/types";

export const meKey = ["me"] as const;

/** The signed-in user, or null for a visitor. */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async (): Promise<User | null> => {
      const { data, response } = await api.GET("/v1/me");
      if (response.status === 401 || response.status === 404) return null;
      if (!response.ok) throw new ApiError(response.statusText, response.status);
      return data as User;
    },
    staleTime: 5 * 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
  });
}

export function displayName(user: Pick<User, "name" | "username"> | null | undefined): string {
  return user?.name?.trim() || user?.username || "";
}

export function useGuestLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => unwrap(api.POST("/v1/auth/guest", { body: { username } })),
    onSuccess: (user) => qc.setQueryData(meKey, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    // unwrap throws on an HTTP error, so a failed logout keeps the session shown
    mutationFn: () => unwrap(api.GET("/v1/auth/logout")),
    onSuccess: () => {
      qc.setQueryData(meKey, null);
      void qc.invalidateQueries();
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string | null; username?: string | null }) =>
      unwrap(api.PATCH("/v1/me", { body })),
    onSuccess: (user) => qc.setQueryData(meKey, user),
  });
}
