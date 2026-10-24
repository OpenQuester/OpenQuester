import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";

type S = components["schemas"];
export type StorageLimits = S["StorageLimits"];
export type StorageGroup = S["StorageGroup"];
export type MyStorage = S["MyStorage"];
export type AdminStorage = S["AdminStorage"];

export const myStorageKey = ["me", "storage"] as const;

export function useMyStorage(enabled = true) {
  return useQuery({
    queryKey: myStorageKey,
    enabled,
    queryFn: () => unwrap(api.GET("/v1/me/storage")),
  });
}

export function useAdminStorage(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "storage"],
    enabled,
    queryFn: () => unwrap(api.GET("/v1/admin/api/storage")),
  });
}

export function useSetGroupLimits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ group, limits }: { group: StorageGroup; limits: StorageLimits }) =>
      unwrap(
        api.PUT("/v1/admin/api/storage/groups/{group}", {
          params: { path: { group } },
          body: limits,
        }),
      ),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "storage"] });
      void qc.invalidateQueries({ queryKey: myStorageKey });
    },
  });
}

export function useSetUserQuota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quotaBytes }: { id: number; quotaBytes: number | null }) => {
      const { error, response } = await api.PUT("/v1/admin/api/storage/users/{id}", {
        params: { path: { id } },
        body: { quotaBytes },
      });
      if (!response.ok) await unwrap(Promise.resolve({ error, response }));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "storage"] });
      void qc.invalidateQueries({ queryKey: myStorageKey });
    },
  });
}

const MB = 1024 * 1024;

/** Megabytes for an input field; empty means no limit. */
export function toMbInput(bytes: number | null): string {
  if (bytes === null) return "";
  return String(bytes / MB);
}

/** Bytes from an input field; empty means no limit, anything else invalid is undefined. */
export function fromMbInput(value: string): number | null | undefined {
  const v = value.trim().replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * MB) : undefined;
}
