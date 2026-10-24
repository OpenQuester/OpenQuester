import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/client";
import { useMe } from "@/features/auth/useMe";
import { usePackage } from "@/features/packages/usePackages";
import { useSettings } from "@/features/settings/settingsStore";
import { loadStash } from "./stash";
import {
  getUploadState,
  readPackageFile,
  resumeFromFile,
  resumeUpload,
  RESUME_OTHER_SOURCE,
  type UploadProgress,
  type UploadResult,
} from "./upload";
import { useUploadWarning } from "./useUploadWarning";

type Run =
  | { kind: "idle"; error?: string }
  | { kind: "reading"; name: string }
  | { kind: "uploading"; progress: UploadProgress };

export function useResumeUpload(id: number) {
  const { t } = useTranslation();
  const me = useMe();
  const qc = useQueryClient();
  const pkg = usePackage(id);
  const state = useQuery({
    queryKey: ["package-upload", id],
    enabled: me.data != null,
    queryFn: () => getUploadState(id),
    retry: false,
  });
  const missing = state.data?.missing ?? [];
  const stash = useQuery({
    queryKey: ["upload-stash", id, missing],
    enabled: missing.length > 0,
    queryFn: () => loadStash(id, missing),
  });
  const [run, setRun] = useState<Run>({ kind: "idle" });

  useUploadWarning(run.kind === "uploading");

  const onProgress = (progress: UploadProgress) => setRun({ kind: "uploading", progress });

  async function finish(job: Promise<UploadResult & { unmatched: string[] }>) {
    try {
      const result = await job;
      qc.setQueryData(["package-upload", id], result.state ?? undefined);
      void qc.invalidateQueries({ queryKey: ["package-upload", id] });
      void qc.invalidateQueries({ queryKey: ["upload-stash", id] });
      void qc.invalidateQueries({ queryKey: ["package", id] });
      void qc.invalidateQueries({ queryKey: ["packages"] });
      void qc.invalidateQueries({ queryKey: ["me", "storage"] });
      setRun({
        kind: "idle",
        error:
          result.state?.status === "ready"
            ? undefined
            : result.unmatched.length > 0
              ? t("resume.notInFile", { count: result.unmatched.length })
              : result.failed.length > 0
                ? t("upload.partial", { count: result.failed.length })
                : undefined,
      });
    } catch (err) {
      setRun({
        kind: "idle",
        error:
          err instanceof ApiError && err.status === 0
            ? t("upload.networkError")
            : err instanceof Error
              ? err.message === RESUME_OTHER_SOURCE
                ? t("upload.readErrors.otherSource")
                : err.message
              : String(err),
      });
    }
  }

  async function pick(file: File) {
    setRun({ kind: "reading", name: file.name });
    try {
      const parsed = await readPackageFile(file);
      // Saving from a different file would replace this package's content.
      if (pkg.data && parsed.content.title.trim() !== pkg.data.title.trim()) {
        setRun({
          kind: "idle",
          error: t("resume.otherPackage", { picked: parsed.content.title, title: pkg.data.title }),
        });
        return;
      }
      await finish(resumeFromFile(id, parsed, onProgress, useSettings.getState().compressMedia));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setRun({
        kind: "idle",
        error: t(`upload.readErrors.${code}`, { defaultValue: t("upload.readErrors.generic") }),
      });
    }
  }

  return {
    me,
    pkg,
    state,
    stash,
    run,
    pick,
    uploadStashed: () => finish(resumeUpload(id, stash.data ?? new Map(), onProgress)),
  };
}
