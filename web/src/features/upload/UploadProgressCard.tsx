import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";

import type { OptimizeProgress } from "./optimize";
import type { FileProgress, FileState, UploadProgress } from "./upload";

/** Failed and active files first, so what needs attention is on top. */
const ORDER: Record<FileState, number> = { failed: 0, uploading: 1, waiting: 2, done: 3 };
const SHOWN_FILES = 8;

/** Overall bar plus a row per media file with its own progress. */
export function UploadProgressCard({
  title,
  progress,
}: {
  title: string;
  progress: UploadProgress;
}) {
  const { t } = useTranslation();
  const o = progress.optimize;
  const pct = Math.round(Math.min(1, uploadRatio(progress)) * 100);
  return (
    <Card data-testid="upload-progress">
      <div className="flex flex-col gap-4">
        <p className="m-0 font-semibold [overflow-wrap:anywhere]">{title}</p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={t("upload.progressLabel")}
          className="h-3 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="m-0 text-sm text-soft" aria-live="polite">
          {o
            ? compressLabel(o, t)
            : progress.phase === "creating"
              ? t("upload.creating")
              : progress.phase === "checking" || progress.phase === "done"
                ? t("upload.checking")
                : t("upload.sending", {
                    done: progress.done,
                    total: progress.total,
                    sent: formatBytes(progress.sentBytes),
                    size: formatBytes(progress.totalBytes),
                  })}
        </p>
        {progress.files.length > 0 && <FileList files={progress.files} />}
        <p className="m-0 text-sm text-muted">{t("upload.keepOpen")}</p>
      </div>
    </Card>
  );
}

/** 0–1 through the whole upload, for the overall bar. */
export function uploadRatio(p: UploadProgress): number {
  const o = p.optimize;
  if (o) return o.total > 0 ? (o.done + o.current) / o.total : 1;
  if (p.phase === "creating" || p.phase === "checking") return p.totalBytes > 0 ? 1 : 0.03;
  return p.totalBytes > 0 ? 0.05 + 0.95 * (p.sentBytes / p.totalBytes) : 1;
}

export function FileList({ files }: { files: FileProgress[] }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const sorted = [...files].sort((a, b) => ORDER[a.state] - ORDER[b.state]);
  const shown = all ? sorted : sorted.slice(0, SHOWN_FILES);
  return (
    <div className="flex flex-col gap-2">
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0" data-testid="upload-files">
        {shown.map((f) => (
          <li
            key={f.md5}
            data-testid="upload-file"
            data-state={f.state}
            className="flex flex-col gap-1.5 rounded-[12px] bg-surface-2 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-3 text-sm">
              <span className="shrink-0 text-muted">{t(`upload.fileType.${f.type}`)}</span>
              <span className="min-w-0 flex-1 truncate" title={f.name}>
                {f.name}
              </span>
              <span
                className={cn(
                  "shrink-0 font-semibold",
                  f.state === "done" && "text-success",
                  f.state === "failed" && "text-danger",
                  f.state === "waiting" && "text-muted",
                )}
              >
                {f.state === "uploading"
                  ? `${Math.round((100 * f.sent) / Math.max(1, f.bytes))}%`
                  : t(`upload.fileState.${f.state}`)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className={cn(
                    "h-full rounded-full",
                    f.state === "failed" ? "bg-danger" : "bg-accent",
                  )}
                  style={{
                    width: `${f.state === "failed" ? 100 : Math.round((100 * f.sent) / Math.max(1, f.bytes))}%`,
                  }}
                />
              </div>
              <span className="shrink-0 text-xs text-muted">{formatBytes(f.bytes)}</span>
            </div>
          </li>
        ))}
      </ul>
      {files.length > SHOWN_FILES && (
        <Button size="sm" variant="ghost" className="self-start" onClick={() => setAll((v) => !v)}>
          {all ? t("upload.showFewer") : t("upload.showAllFiles", { count: files.length })}
        </Button>
      )}
    </div>
  );
}

export function compressLabel(o: OptimizeProgress, t: TFunction): string {
  return t("upload.compress.progress", {
    done: Math.min(o.done + 1, o.total),
    total: o.total,
    before: formatBytes(o.bytesBefore),
    after: formatBytes(o.bytesAfter),
  });
}
