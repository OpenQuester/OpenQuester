import { Navigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/client";
import { Card } from "@/ui/Card";
import { Button } from "@/ui/Button";
import { Spinner } from "@/ui/Spinner";
import { UploadPageLayout } from "./UploadPageLayout";
import { UploadProgressCard } from "./UploadProgressCard";
import { ResumeUploadResult } from "./ResumeUploadResult";
import { ResumeUploadProgress } from "./ResumeUploadProgress";
import { HtmlRemovalDialog } from "./HtmlRemovalDialog";
import { useResumeUpload } from "./useResumeUpload";

/** Resume from this browser's stash or the same archive picked again. */
export function ResumeUploadPage() {
  const { t } = useTranslation();
  const { packageId } = useParams({ from: "/shell/packages/$packageId/upload" });
  const id = Number(packageId);
  const { confirmation, me, pkg, state, stash, run, pick, uploadStashed } = useResumeUpload(id);
  if (me.isFetched && !me.data)
    return <Navigate to="/login" search={{ redirect: `/packages/${id}/upload` }} />;

  const title = pkg.data?.title ?? "";
  const s = state.data;
  const err = state.error;

  return (
    <UploadPageLayout
      title={t("resume.title")}
      backTo="/packages/mine"
      backLabel={t("myPackages.title")}
      description={title && <p className="m-0 text-soft [overflow-wrap:anywhere]">{title}</p>}
    >
      <HtmlRemovalDialog report={confirmation.report} settle={confirmation.settle} />
      {state.isLoading || me.isLoading ? (
        <Spinner label={t("common.loading")} />
      ) : err ? (
        <Card data-testid="resume-error">
          <p role="alert" className="m-0 text-danger">
            {err instanceof ApiError && err.status === 403
              ? t("resume.notYours")
              : err instanceof ApiError && err.status === 404
                ? t("resume.notFound")
                : err instanceof ApiError
                  ? err.message
                  : t("upload.networkError")}
          </p>
          <Button onClick={() => void state.refetch()} disabled={state.isFetching}>
            {t("game.tryAgain")}
          </Button>
        </Card>
      ) : run.kind === "uploading" ? (
        <UploadProgressCard title={title} progress={run.progress} />
      ) : run.kind === "reading" ? (
        <Card>
          <Spinner label={t("upload.reading", { name: run.name })} />
        </Card>
      ) : s?.status === "ready" ? (
        <ResumeUploadResult id={id} totalFiles={s.totalFiles} />
      ) : s ? (
        <ResumeUploadProgress
          state={s}
          stashed={stash.data?.size ?? 0}
          error={run.error}
          onFile={(f) => void pick(f)}
          onUploadStashed={() => void uploadStashed()}
        />
      ) : null}
    </UploadPageLayout>
  );
}
