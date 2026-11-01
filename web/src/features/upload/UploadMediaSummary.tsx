import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { StorageMeter } from "@/features/storage/StorageMeter";
import { formatBytes } from "@/lib/format";
import { MediaCompressionNotice } from "./MediaCompressionNotice";
import type { MediaFile } from "./types";

export function UploadMediaSummary({ files }: { files: Map<string, MediaFile> }) {
  const { t } = useTranslation();
  const media = [...files.values()];
  const originalBytes = media.reduce((sum, file) => sum + file.bytes.byteLength, 0);
  const estimate = useQuery({
    queryKey: [
      "upload-size-estimate",
      media.map((f) => [f.md5, f.name, f.type, f.bytes.byteLength, !!f.preserveEncoding]),
    ],
    queryFn: async ({ signal }) => {
      const { estimateMediaBytes } = await import("./optimize/estimate");
      return estimateMediaBytes(files, signal);
    },
    staleTime: Infinity,
    retry: false,
  });
  const estimatedBytes = estimate.data ?? (estimate.isError ? originalBytes : undefined);
  return (
    <div className="flex flex-col gap-4" data-testid="upload-media-summary">
      <MediaCompressionNotice />
      <dl className="m-0 grid grid-cols-2 gap-3 rounded-lg bg-surface-2 p-4">
        <div>
          <dt className="text-sm text-soft">{t("upload.compress.before")}</dt>
          <dd className="m-0 mt-1 font-semibold">{formatBytes(originalBytes)}</dd>
        </div>
        <div>
          <dt className="text-sm text-soft">{t("upload.compress.estimate")}</dt>
          <dd className="m-0 mt-1 font-semibold" role="status">
            {estimatedBytes === undefined
              ? t("upload.compress.estimating")
              : `≈ ${formatBytes(estimatedBytes)}`}
          </dd>
        </div>
      </dl>
      <p className="m-0 text-sm text-muted">{t("upload.compress.estimateHelp")}</p>
      <StorageMeter pendingBytes={estimatedBytes} />
    </div>
  );
}
