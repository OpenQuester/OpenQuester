import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, unwrap } from "@/api/client";
import type { OqPackage } from "@/api/types";

export type PackageSort = "newest" | "oldest" | "title" | "titleDesc" | "author";

export interface PackageFilters {
  title: string;
  language: string;
  sort: PackageSort;
  age: "" | "NONE" | "A12" | "A16" | "A18";
  minRounds: number | null;
  maxRounds: number | null;
  minQuestions: number | null;
  maxQuestions: number | null;
  /** Only packages by this author (the "Mine" filter). */
  authorId: number | null;
}

/** `uploading` while some media isn't in storage yet; such a package can't be played. */
export type UploadStatus = "uploading" | "ready";

export const NO_FILTERS: Omit<PackageFilters, "title" | "sort"> = {
  language: "",
  age: "",
  minRounds: null,
  maxRounds: null,
  minQuestions: null,
  maxQuestions: null,
  authorId: null,
};

/** How many of the extra filters (beyond search and language) are set. */
export function extraFilterCount(f: PackageFilters): number {
  return [f.age, f.minRounds, f.maxRounds, f.minQuestions, f.maxQuestions, f.authorId].filter(
    (v) => v !== "" && v != null,
  ).length;
}

const SORTS: Record<
  PackageSort,
  { sortBy: "created_at" | "title" | "author"; order: "asc" | "desc" }
> = {
  newest: { sortBy: "created_at", order: "desc" },
  oldest: { sortBy: "created_at", order: "asc" },
  title: { sortBy: "title", order: "asc" },
  titleDesc: { sortBy: "title", order: "desc" },
  author: { sortBy: "author", order: "asc" },
};

export const PAGE_SIZE = 24;

/** List items carry round/question counts at runtime even though the schema types them loosely. */
export interface PackageCard {
  id: number;
  title: string;
  description?: string | null;
  createdAt: string;
  author: { id: number; username: string };
  ageRestriction: string;
  language?: string | null;
  roundsCount?: number;
  questionsCount?: number;
  tags?: unknown[] | null;
  uploadStatus?: UploadStatus;
}

export function usePackages(filters: PackageFilters, page: number, enabled = true) {
  return useQuery({
    queryKey: ["packages", filters, page],
    enabled,
    queryFn: async () => {
      const res = await unwrap(
        api.GET("/v1/packages", {
          params: {
            query: {
              limit: PAGE_SIZE,
              offset: page * PAGE_SIZE,
              ...SORTS[filters.sort],
              ...(filters.title.trim() ? { title: filters.title.trim() } : {}),
              ...(filters.language ? { language: filters.language } : {}),
              ...(filters.age ? { ageRestriction: filters.age } : {}),
              ...(filters.minRounds != null ? { minRounds: filters.minRounds } : {}),
              ...(filters.maxRounds != null ? { maxRounds: filters.maxRounds } : {}),
              ...(filters.minQuestions != null ? { minQuestions: filters.minQuestions } : {}),
              ...(filters.maxQuestions != null ? { maxQuestions: filters.maxQuestions } : {}),
              // Someone else's half-uploaded package can't be played, so only
              // an author's own list shows unfinished uploads.
              ...(filters.authorId != null
                ? { authorId: filters.authorId }
                : { uploadStatus: "ready" as const }),
            },
          },
        }),
      );
      return { items: res.data as unknown as PackageCard[], total: res.pageInfo.total };
    },
    placeholderData: keepPreviousData,
  });
}

export function usePackage(id: number | null | undefined) {
  return useQuery({
    queryKey: ["package", id],
    enabled: id != null,
    queryFn: async () =>
      (await unwrap(api.GET("/v1/packages/{id}", { params: { path: { id: id! } } }))) as OqPackage,
  });
}
