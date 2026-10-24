import { layoutStyles } from "@/ui/layoutStyles";
import { uploadStyles } from "./uploadStyles";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";
import { Button } from "@/ui/Button";
import type { FileProgress, FileState } from "./upload";

/** Failed and active files first, so what needs attention is on top. */
const ORDER: Record<FileState, number> = { failed: 0, uploading: 1, waiting: 2, done: 3 };
const SHOWN_FILES = 8;

export function UploadFileList({ files }: { files: FileProgress[] }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const sorted = [...files].sort((a, b) => ORDER[a.state] - ORDER[b.state]);
  const shown = all ? sorted : sorted.slice(0, SHOWN_FILES);
  return (
    <div className="flex flex-col gap-2">
      <ul className={layoutStyles.compactList} data-testid="upload-files">
        {shown.map((f) => (
          <li
            key={f.md5}
            data-testid="upload-file"
            data-state={f.state}
            className={uploadStyles.file}
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
