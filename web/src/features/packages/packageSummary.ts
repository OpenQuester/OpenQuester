import type { OqPackage } from "@/api/types";

export interface PackageSummary {
  rounds: { name: string; type: string; themes: number; questions: number }[];
  questionCount: number;
  hasImages: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  specialTypes: string[];
}

/** Counts and features shown in the package detail panel. */
export function summarizePackage(pkg: OqPackage): PackageSummary {
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
