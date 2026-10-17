import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/app/AppShell";
import { ApiError } from "@/api/client";
import { useMe } from "@/features/auth/useMe";
import { usePackage } from "@/features/packages/usePackages";
import { useSettings } from "@/features/settings/settingsStore";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { BackIcon, CheckIcon, UploadIcon } from "@/ui/icons";
import { Spinner } from "@/ui/Spinner";

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
import { CompressToggle, DropZone } from "./UploadPackagePage";
import { UploadProgressCard } from "./UploadProgressCard";

type Run =
  | { kind: "idle"; error?: string }
  | { kind: "reading"; name: string }
  | { kind: "uploading"; progress: UploadProgress };

/**
 * `/packages/$packageId/upload`: finishes an upload that was interrupted.
 * Files this browser kept from the first try are sent straight away;
 * otherwise the author picks the same package file again and only the
 * missing media is uploaded.
 */
export function ResumeUploadPage() {
  const { t } = useTranslation();
  const { packageId } = useParams({ from: "/shell/packages/$packageId/upload" });
  const id = Number(packageId);
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

  const busy = run.kind === "uploading";
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

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

  if (me.isFetched && !me.data)
    return <Navigate to="/login" search={{ redirect: `/packages/${id}/upload` }} />;

  const title = pkg.data?.title ?? "";
  const s = state.data;
  const stashed = stash.data?.size ?? 0;
  const err = state.error instanceof ApiError ? state.error : null;

  return (
    <PageContainer width={880}>
      <div className="flex flex-col gap-6">
        <Link
          to="/packages/mine"
          className="inline-flex items-center gap-1.5 self-start text-muted no-underline hover:text-text"
        >
          <BackIcon size={18} />
          {t("myPackages.title")}
        </Link>
        <header className="flex flex-col gap-2">
          <h1 className="m-0 font-display text-4xl font-extrabold tracking-tight">
            {t("resume.title")}
          </h1>
          {title && <p className="m-0 text-soft [overflow-wrap:anywhere]">{title}</p>}
        </header>

        {state.isLoading || me.isLoading ? (
          <Spinner label={t("common.loading")} />
        ) : err ? (
          <Card data-testid="resume-error">
            <p role="alert" className="m-0 text-danger">
              {err.status === 403
                ? t("resume.notYours")
                : err.status === 404
                  ? t("resume.notFound")
                  : err.message}
            </p>
          </Card>
        ) : run.kind === "uploading" ? (
          <UploadProgressCard title={title} progress={run.progress} />
        ) : run.kind === "reading" ? (
          <Card>
            <Spinner label={t("upload.reading", { name: run.name })} />
          </Card>
        ) : s?.status === "ready" ? (
          <Card tone="accent" data-testid="resume-done">
            <div className="flex flex-col gap-4">
              <p className="m-0 flex items-center gap-2 font-display text-2xl font-extrabold">
                <CheckIcon size={26} />
                {t("resume.done")}
              </p>
              <p className="m-0 text-soft">{t("resume.doneHelp", { count: s.totalFiles })}</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/games/new"
                  search={{ packageId: id }}
                  className="flex min-h-14 flex-1 items-center justify-center rounded-md bg-accent px-6 text-lg font-semibold text-on-accent no-underline hover:text-on-accent sm:flex-none"
                >
                  {t("packages.host")}
                </Link>
                <Link
                  to="/packages"
                  search={{ id }}
                  className="flex min-h-14 flex-1 items-center justify-center rounded-md border border-line-strong px-6 font-semibold text-text no-underline hover:text-text sm:flex-none"
                >
                  {t("upload.viewPackage")}
                </Link>
              </div>
            </div>
          </Card>
        ) : s ? (
          <div className="flex flex-col gap-5" data-testid="resume-pending">
            <Card>
              <div className="flex flex-col gap-3">
                <p className="m-0 text-lg font-semibold" data-testid="resume-summary">
                  {t("upload.unfinished", { uploaded: s.uploadedFiles, total: s.totalFiles })}
                </p>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={s.totalFiles}
                  aria-valuenow={s.uploadedFiles}
                  aria-label={t("upload.progressLabel")}
                  className="h-3 overflow-hidden rounded-full bg-surface-2"
                >
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(100 * s.uploadedFiles) / Math.max(1, s.totalFiles)}%` }}
                  />
                </div>
                <p className="m-0 text-soft">{t("upload.unfinishedHelp")}</p>
              </div>
            </Card>
            {run.error && (
              <p role="alert" className="m-0 text-danger [overflow-wrap:anywhere]">
                {run.error}
              </p>
            )}
            {stashed > 0 && (
              <Card tone="raised" data-testid="resume-stash">
                <div className="flex flex-col gap-3">
                  <p className="m-0 text-soft">
                    {stashed === s.missing.length
                      ? t("resume.stashAll", { count: stashed })
                      : t("resume.stashSome", { count: stashed, total: s.missing.length })}
                  </p>
                  <Button
                    variant="accent"
                    size="lg"
                    className="sm:self-start"
                    icon={<UploadIcon size={20} />}
                    onClick={() =>
                      void finish(resumeUpload(id, stash.data ?? new Map(), onProgress))
                    }
                  >
                    {t("resume.uploadStashed", { count: stashed })}
                  </Button>
                </div>
              </Card>
            )}
            {stashed < s.missing.length && (
              <div className="flex flex-col gap-3" data-testid="resume-pick">
                <p className="m-0 text-soft">{t("resume.pickHelp")}</p>
                <DropZone onFile={(f) => void pick(f)} />
                <CompressToggle />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}
