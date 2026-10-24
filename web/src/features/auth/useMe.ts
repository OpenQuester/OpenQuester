import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError, unwrap } from "@/api/client";
import type { User } from "@/api/types";

export const meKey = ["me"] as const;

/** Account changes must cancel old reads as well as forget their cached results. */
export function clearAccountQueries(qc: QueryClient) {
  qc.removeQueries({ predicate: (q) => q.queryKey.length !== 1 || q.queryKey[0] !== "me" });
}

/** The signed-in user, or null for a visitor. */
export function useMe() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: meKey,
    queryFn: async (): Promise<User | null> => {
      const { data, response } = await api.GET("/v1/me");
      const signedOut = response.status === 401 || response.status === 404;
      if (!signedOut && !response.ok) throw new ApiError(response.statusText, response.status);
      const user = signedOut ? null : (data as User);
      const previous = qc.getQueryData<User | null>(meKey);
      // The first auth lookup can overlap public queries; it is not an account switch.
      if (previous !== undefined && previous?.id !== user?.id) clearAccountQueries(qc);
      return user;
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
    onSuccess: (user) => {
      void qc.cancelQueries({ queryKey: meKey, exact: true });
      clearAccountQueries(qc);
      qc.setQueryData(meKey, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    // unwrap throws on an HTTP error, so a failed logout keeps the session shown
    mutationFn: () => unwrap(api.GET("/v1/auth/logout")),
    onSuccess: () => {
      void qc.cancelQueries({ queryKey: meKey, exact: true });
      clearAccountQueries(qc);
      qc.setQueryData(meKey, null);
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
