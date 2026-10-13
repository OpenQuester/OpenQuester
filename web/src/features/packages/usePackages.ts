import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, unwrap } from "@/api/client";
import type { OqPackage } from "@/api/types";

export interface PackageFilters {
  title: string;
  language: string;
  sort: "newest" | "title";
}

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
}

export function usePackages(filters: PackageFilters, page: number) {
  return useQuery({
    queryKey: ["packages", filters, page],
    queryFn: async () => {
      const res = await unwrap(
        api.GET("/v1/packages", {
          params: {
            query: {
              limit: PAGE_SIZE,
              offset: page * PAGE_SIZE,
              sortBy: filters.sort === "title" ? "title" : "created_at",
              order: filters.sort === "title" ? "asc" : "desc",
              ...(filters.title.trim() ? { title: filters.title.trim() } : {}),
              ...(filters.language ? { language: filters.language } : {}),
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

export interface PackageSummary {
  rounds: { name: string; type: string; themes: number; questions: number }[];
  questionCount: number;
  hasImages: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  specialTypes: string[];
}

/** Counts and features shown in the package detail panel. */
export function summarize(pkg: OqPackage): PackageSummary {
  let questionCount = 0;
  let hasImages = false;
  let hasAudio = false;
  let hasVideo = false;
  const special = new Set<string>();
  const rounds = [...pkg.rounds]
    .sort((a, b) => a.order - b.order)
    .map((r) => {
      let questions = 0;
      for (const theme of r.themes) {
        for (const q of theme.questions as Array<{
          type: string;
          questionFiles?: { file: { type: string } }[] | null;
        }>) {
          questions += 1;
          if (q.type !== "simple") special.add(q.type);
          for (const f of q.questionFiles ?? []) {
            if (f.file.type === "image") hasImages = true;
            if (f.file.type === "audio") hasAudio = true;
            if (f.file.type === "video") hasVideo = true;
          }
        }
      }
      questionCount += questions;
      return { name: r.name, type: r.type, themes: r.themes.length, questions };
    });
  return { rounds, questionCount, hasImages, hasAudio, hasVideo, specialTypes: [...special] };
}
