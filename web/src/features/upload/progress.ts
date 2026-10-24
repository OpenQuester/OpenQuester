import type { TFunction } from "i18next";
import { formatBytes } from "@/lib/format";
import type { OptimizeProgress } from "./optimize/index";
import type { UploadProgress } from "./upload";

/** 0–1 through the whole upload, for the overall bar. */
export function uploadRatio(p: UploadProgress): number {
  const o = p.optimize;
  if (o) return o.total > 0 ? (o.done + o.current) / o.total : 1;
  if (p.phase === "optimizing") return 0;
  if (p.phase === "creating" || p.phase === "checking") return p.totalBytes > 0 ? 1 : 0.03;
  return p.totalBytes > 0 ? 0.05 + 0.95 * (p.sentBytes / p.totalBytes) : 1;
}

export function compressLabel(o: OptimizeProgress, t: TFunction): string {
  return t("upload.compress.progress", {
    done: Math.min(o.done + 1, o.total),
    total: o.total,
    before: formatBytes(o.bytesBefore),
    after: formatBytes(o.bytesAfter),
  });
}
