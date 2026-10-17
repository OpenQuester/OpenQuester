import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@/api/client";
import { discordEnabled, startDiscordLogin } from "@/features/auth/discord";
import { useMe } from "@/features/auth/useMe";
import { useSettings } from "@/features/settings/settingsStore";
import { CompressToggle } from "@/features/upload/UploadPackagePage";
import { compressLabel, FileList, uploadRatio } from "@/features/upload/UploadProgressCard";
import { uploadPackage, type UploadProgress } from "@/features/upload/upload";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { AlertIcon, CheckIcon, UploadIcon } from "@/ui/icons";

import { toParsed } from "./media";
import { useEditor } from "./store";
import type { Issue, Report } from "./validate";
import { ImportWarnings } from "@/features/upload/ImportWarnings";

type Step =
  | { kind: "check" }
  | { kind: "uploading"; progress: UploadProgress }
  | { kind: "done"; id: number; failed: number; unfinished: boolean }
  | { kind: "failed"; error: string };

/**
 * The publish check: every issue grouped by severity with a jump to its
 * question; Publish stays off while anything critical is left and says why.
 */
export function PublishDialog({
  open,
  onClose,
  report,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  report: Report;
  onJump: (issue: Issue) => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>({ kind: "check" });
  const busy = step.kind === "uploading";
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o || busy) return;
        onClose();
        if (step.kind !== "check") setStep({ kind: "check" });
      }}
      title={t("editor.publish.title")}
      closeLabel={t("common.close")}
    >
      <PublishBody
        report={report}
        step={step}
        setStep={setStep}
        onJump={(i) => (onClose(), onJump(i))}
      />
    </Dialog>
  );
}

function PublishBody({
  report,
  step,
  setStep,
  onJump,
}: {
  report: Report;
  step: Step;
  setStep: (s: Step) => void;
  onJump: (i: Issue) => void;
}) {
  const { t } = useTranslation();
  const me = useMe();
  const qc = useQueryClient();
  const pkg = useEditor((s) => s.pkg);
  const media = useEditor((s) => s.media);
  const setPublished = useEditor((s) => s.setPublished);
  const publishedId = useEditor((s) => s.publishedId);
  const importWarnings = useEditor((s) => s.importWarnings);

  /** With `replace`, saves over the package this draft was published as. */
  const publish = async (replace: boolean) => {
    try {
      const parsed = toParsed(pkg, media);
      const { id, failed, state } = await uploadPackage(
        parsed,
        (progress) => setStep({ kind: "uploading", progress }),
        replace ? publishedId : undefined,
        useSettings.getState().compressMedia,
        // Edited content isn't any imported file any more.
        null,
      );
      setPublished(id);
      void qc.invalidateQueries({ queryKey: ["package", id] });
      void qc.invalidateQueries({ queryKey: ["packages"] });
      void qc.invalidateQueries({ queryKey: ["me", "storage"] });
      void qc.invalidateQueries({ queryKey: ["package-upload", id] });
      setStep({
        kind: "done",
        id,
        failed: failed.length,
        // Without the server's final status, completion is unknown: keep it resumable
        unfinished: state === null || state.status !== "ready",
      });
    } catch (err) {
      setStep({
        kind: "failed",
        error:
          err instanceof ApiError
            ? err.status === 0
              ? t("upload.networkError")
              : err.status === 413 || err.status === 507
                ? err.message
                : err.status === 403 && replace
                  ? t("editor.publish.notYours")
                  : t("upload.serverRejected", { message: err.message })
            : String(err),
      });
    }
  };

  if (step.kind === "uploading") {
    const p = step.progress;
    const o = p.optimize;
    const pct = Math.round(100 * Math.min(1, uploadRatio(p)));
    return (
      <div className="flex flex-col gap-4 p-5" data-testid="publish-progress">
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
            : p.phase === "creating"
              ? t("upload.creating")
              : p.phase === "checking" || p.phase === "done"
                ? t("upload.checking")
                : t("editor.publish.sending", { done: p.done, total: p.total })}
        </p>
        {p.files.length > 0 && <FileList files={p.files} />}
        <p className="m-0 text-sm text-muted">{t("upload.keepOpen")}</p>
      </div>
    );
  }
  if (step.kind === "done")
    return (
      <div className="flex flex-col gap-4 p-5" data-testid="publish-done">
        <p className="m-0 flex items-center gap-2 font-display text-2xl font-extrabold">
          <CheckIcon size={26} />
          {t("upload.done")}
        </p>
        {step.unfinished && (
          <p role="alert" className="m-0 text-warning">
            {step.failed > 0
              ? t("upload.partial", { count: step.failed })
              : t("packages.uploadUnfinished")}
          </p>
        )}
        <p className="m-0 text-soft">
          {step.unfinished ? t("upload.unfinishedHelp") : t("editor.publish.doneHelp")}
        </p>
        <div className="flex flex-wrap gap-3">
          {step.unfinished ? (
            <Link
              to="/packages/$packageId/upload"
              params={{ packageId: String(step.id) }}
              className="flex min-h-14 items-center justify-center rounded-md bg-accent px-6 text-lg font-semibold text-on-accent no-underline hover:text-on-accent"
            >
              {t("packages.resumeUpload")}
            </Link>
          ) : (
            <Link
              to="/games/new"
              search={{ packageId: step.id }}
              className="flex min-h-14 items-center justify-center rounded-md bg-accent px-6 text-lg font-semibold text-on-accent no-underline hover:text-on-accent"
            >
              {t("packages.host")}
            </Link>
          )}
          <Link
            to="/packages"
            search={{ id: step.id }}
            className="flex min-h-14 items-center justify-center rounded-md border border-line-strong px-6 font-semibold text-text no-underline hover:text-text"
          >
            {t("upload.viewPackage")}
          </Link>
        </div>
      </div>
    );

  const groups = (["critical", "warning", "info"] as const)
    .map((s) => ({ s, items: report.issues.filter((i) => i.severity === s) }))
    .filter((g) => g.items.length);
  const signedIn = me.data && !me.data.isGuest;
  const blocked = report.critical > 0 || !signedIn;

  return (
    <div className="flex flex-col gap-5 p-5" data-testid="publish-check">
      {/* What importing the original file changed; the checks below can't see it */}
      {importWarnings.length > 0 && <ImportWarnings warnings={importWarnings} />}
      <p
        className={cn(
          "m-0 flex items-center gap-2 font-semibold",
          report.health === "broken"
            ? "text-danger"
            : report.health === "needsAttention"
              ? "text-warning"
              : "text-success",
        )}
      >
        {report.health === "good" ? <CheckIcon size={20} /> : <AlertIcon size={20} />}
        {t(`editor.health.${report.health}`, { count: report.critical })}
      </p>
      {groups.map((g) => (
        <section key={g.s} className="flex flex-col gap-2">
          <h3 className="m-0 text-sm font-bold tracking-wider text-faint uppercase">
            {t(`editor.severity.${g.s}`, { count: g.items.length })}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {g.items.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => onJump(i)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-sm border px-3 py-2 text-left",
                    g.s === "critical"
                      ? "border-danger/40 bg-danger-surface"
                      : g.s === "warning"
                        ? "border-line bg-warning-surface/50"
                        : "border-line bg-surface-2",
                  )}
                >
                  {i.where && (
                    <span className="text-xs text-faint [overflow-wrap:anywhere]">{i.where}</span>
                  )}
                  <span className="text-sm">{t(`editor.issues.${i.code}`, i.args)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {signedIn && report.critical === 0 && <CompressToggle />}
      {step.kind === "failed" && (
        <p role="alert" className="m-0 text-danger [overflow-wrap:anywhere]">
          {step.error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button
          variant="accent"
          size="lg"
          inactive={blocked}
          disabled={blocked}
          icon={<UploadIcon size={20} />}
          onClick={() => void publish(publishedId != null)}
          data-testid="publish-confirm"
        >
          {publishedId != null ? t("editor.publish.saveChanges") : t("editor.publish.publish")}
        </Button>
        {publishedId != null && !blocked && (
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => void publish(false)}
          >
            {t("editor.publish.publishAsNew")}
          </Button>
        )}
        {report.critical > 0 ? (
          <p className="m-0 text-sm text-danger">
            {t("editor.publish.blocked", { count: report.critical })}
          </p>
        ) : !signedIn ? (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-sm text-muted">
              {me.data?.isGuest ? t("upload.guestHelp") : t("upload.signInFirst")}
            </p>
            {discordEnabled && (
              <Button
                size="sm"
                className="self-start"
                onClick={() => void startDiscordLogin(window.location.pathname)}
              >
                {t("login.discord")}
              </Button>
            )}
          </div>
        ) : (
          <p className="m-0 text-sm text-muted">{t("editor.publish.help")}</p>
        )}
      </div>
    </div>
  );
}
