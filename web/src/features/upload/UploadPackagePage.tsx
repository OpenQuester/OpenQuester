import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { PageContainer } from "@/app/AppShell";
import { ApiError } from "@/api/client";
import { discordEnabled, startDiscordLogin } from "@/features/auth/discord";
import { useMe } from "@/features/auth/useMe";
import { cn } from "@/lib/cn";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { BackIcon, CheckIcon, EditIcon, UploadIcon } from "@/ui/icons";
import { Spinner } from "@/ui/Spinner";

import type { ImportWarning, ParsedPackage } from "./types";
import {
  ACCEPT,
  describe,
  readPackageFile,
  retryMedia,
  uploadPackage,
  type PendingFile,
  type UploadProgress,
} from "./upload";

type Step =
  | { kind: "pick"; error?: string }
  | { kind: "reading"; name: string }
  | { kind: "review"; name: string; parsed: ParsedPackage }
  | { kind: "uploading"; parsed: ParsedPackage; progress: UploadProgress }
  | { kind: "partial"; parsed: ParsedPackage; id: number; failed: PendingFile[] }
  | { kind: "done"; id: number; title: string }
  | { kind: "failed"; parsed: ParsedPackage; name: string; error: string };

export function UploadPackagePage() {
  const { t } = useTranslation();
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>({ kind: "pick" });

  // Leaving mid-upload would strand a half-uploaded package.
  const busy = step.kind === "uploading";
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  async function pick(file: File) {
    setStep({ kind: "reading", name: file.name });
    try {
      const parsed = await readPackageFile(file);
      setStep({ kind: "review", name: file.name, parsed });
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setStep({
        kind: "pick",
        error: t(`upload.readErrors.${code}`, { defaultValue: t("upload.readErrors.generic") }),
      });
    }
  }

  async function upload(parsed: ParsedPackage, name: string) {
    const onProgress = (progress: UploadProgress) =>
      setStep({ kind: "uploading", parsed, progress });
    try {
      const { id, failed } = await uploadPackage(parsed, onProgress);
      void qc.invalidateQueries({ queryKey: ["packages"] });
      setStep(
        failed.length
          ? { kind: "partial", parsed, id, failed }
          : { kind: "done", id, title: parsed.content.title },
      );
    } catch (err) {
      setStep({ kind: "failed", parsed, name, error: uploadError(err, t) });
    }
  }

  async function edit(parsed: ParsedPackage) {
    const { draftFromParsed } = await import("@/features/editor/EditorHomePage");
    const draftId = await draftFromParsed(parsed);
    void navigate({ to: "/packages/editor/$draftId", params: { draftId } });
  }

  async function retry(parsed: ParsedPackage, id: number, pending: PendingFile[]) {
    const failed = await retryMedia(pending, (progress) =>
      setStep({ kind: "uploading", parsed, progress }),
    );
    setStep(
      failed.length
        ? { kind: "partial", parsed, id, failed }
        : { kind: "done", id, title: parsed.content.title },
    );
  }

  return (
    <PageContainer width={880}>
      <div className="flex flex-col gap-6">
        <Link
          to="/packages"
          className="inline-flex items-center gap-1.5 self-start text-muted no-underline hover:text-text"
        >
          <BackIcon size={18} />
          {t("upload.back")}
        </Link>
        <header className="flex flex-col gap-2">
          <h1 className="m-0 font-display text-4xl font-extrabold tracking-tight">
            {t("upload.title")}
          </h1>
          <p className="m-0 text-soft">{t("upload.lead")}</p>
        </header>

        {me.isLoading ? (
          <Spinner label={t("common.loading")} />
        ) : !me.data ? (
          <Card>
            <div className="flex flex-col gap-4">
              <p className="m-0 text-soft">{t("upload.signInFirst")}</p>
              <Link
                to="/login"
                search={{ redirect: "/packages/upload" }}
                className="flex min-h-14 items-center justify-center rounded-md bg-accent text-lg font-semibold text-on-accent no-underline hover:text-on-accent sm:self-start sm:px-8"
              >
                {t("nav.signIn")}
              </Link>
            </div>
          </Card>
        ) : me.data.isGuest ? (
          <Card data-testid="upload-guest">
            <div className="flex flex-col gap-4">
              <p className="m-0 font-semibold">{t("upload.guestTitle")}</p>
              <p className="m-0 text-soft">{t("upload.guestHelp")}</p>
              {discordEnabled ? (
                <Button
                  variant="primary"
                  size="lg"
                  className="sm:self-start"
                  onClick={() => void startDiscordLogin("/packages/upload")}
                >
                  {t("login.discord")}
                </Button>
              ) : (
                <p className="m-0 text-sm text-muted">{t("upload.discordUnavailable")}</p>
              )}
            </div>
          </Card>
        ) : step.kind === "pick" ? (
          <DropZone onFile={(f) => void pick(f)} error={step.error} />
        ) : step.kind === "reading" ? (
          <Card>
            <Spinner label={t("upload.reading", { name: step.name })} />
          </Card>
        ) : step.kind === "review" ? (
          <Review
            parsed={step.parsed}
            name={step.name}
            onUpload={() => void upload(step.parsed, step.name)}
            onEdit={() => void edit(step.parsed)}
            onCancel={() => setStep({ kind: "pick" })}
          />
        ) : step.kind === "uploading" ? (
          <Progress title={step.parsed.content.title} progress={step.progress} />
        ) : step.kind === "partial" ? (
          <Card data-testid="upload-partial">
            <div className="flex flex-col gap-4">
              <p role="alert" className="m-0 font-semibold text-warning">
                {t("upload.partial", { count: step.failed.length })}
              </p>
              <p className="m-0 text-soft">{t("upload.partialHelp")}</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="accent"
                  size="lg"
                  onClick={() => void retry(step.parsed, step.id, step.failed)}
                >
                  {t("upload.retryFiles")}
                </Button>
                <Link
                  to="/packages"
                  search={{ id: step.id }}
                  className="flex min-h-14 items-center rounded-md border border-line-strong px-6 font-semibold text-text no-underline hover:text-text"
                >
                  {t("upload.viewPackage")}
                </Link>
              </div>
            </div>
          </Card>
        ) : step.kind === "done" ? (
          <Card tone="accent" data-testid="upload-done">
            <div className="flex flex-col gap-4">
              <p className="m-0 flex items-center gap-2 font-display text-2xl font-extrabold">
                <CheckIcon size={26} />
                {t("upload.done")}
              </p>
              <p className="m-0 text-soft [overflow-wrap:anywhere]">
                {t("upload.doneHelp", { title: step.title })}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/games/new"
                  search={{ packageId: step.id }}
                  className="flex min-h-14 flex-1 items-center justify-center rounded-md bg-accent px-6 text-lg font-semibold text-on-accent no-underline hover:text-on-accent sm:flex-none"
                >
                  {t("packages.host")}
                </Link>
                <Link
                  to="/packages"
                  search={{ id: step.id }}
                  className="flex min-h-14 flex-1 items-center justify-center rounded-md border border-line-strong px-6 font-semibold text-text no-underline hover:text-text sm:flex-none"
                >
                  {t("upload.viewPackage")}
                </Link>
                <Button size="lg" variant="ghost" onClick={() => setStep({ kind: "pick" })}>
                  {t("upload.another")}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card data-testid="upload-failed">
            <div className="flex flex-col gap-4">
              <p role="alert" className="m-0 font-semibold text-danger [overflow-wrap:anywhere]">
                {step.error}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="accent"
                  size="lg"
                  onClick={() => void upload(step.parsed, step.name)}
                >
                  {t("upload.tryAgain")}
                </Button>
                <Button size="lg" onClick={() => setStep({ kind: "pick" })}>
                  {t("upload.another")}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}

function DropZone({ onFile, error }: { onFile: (f: File) => void; error?: string }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };
  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-4 rounded-lg border-2 border-dashed px-5 py-10 text-center sm:py-14",
          over ? "border-accent bg-accent-surface" : "border-line-strong bg-surface",
        )}
      >
        <span className="grid size-16 place-items-center rounded-full bg-surface-2 text-accent">
          <UploadIcon size={30} />
        </span>
        <p className="m-0 text-lg font-semibold">{t("upload.drop")}</p>
        <p className="m-0 max-w-[46ch] text-sm text-muted">{t("upload.formats")}</p>
        <input
          ref={input}
          id="package-file"
          type="file"
          accept={ACCEPT}
          className="sr-only"
          // The visible button opens it; one control for assistive tech.
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
        <Button variant="accent" size="lg" onClick={() => input.current?.click()}>
          {t("upload.choose")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="m-0 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Review({
  parsed,
  name,
  onUpload,
  onEdit,
  onCancel,
}: {
  parsed: ParsedPackage;
  name: string;
  onUpload: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const c = parsed.content;
  const totals = describe(parsed);
  const empty = totals.questions === 0;
  return (
    <div className="flex flex-col gap-5" data-testid="upload-review">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted [overflow-wrap:anywhere]">
              {t(`upload.format.${parsed.format}`)} · {name}
            </span>
            <h2 className="m-0 font-display text-[clamp(24px,3vw,30px)] font-extrabold [overflow-wrap:anywhere]">
              {c.title}
            </h2>
            {c.description && <p className="m-0 text-soft">{c.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{t("upload.questionCount", { count: totals.questions })}</Badge>
            <Badge>
              {t("upload.mediaCount", {
                count: totals.mediaCount,
                size: formatBytes(totals.bytes),
              })}
            </Badge>
            {c.language && <Badge>{c.language.toUpperCase()}</Badge>}
            {c.ageRestriction !== "NONE" && (
              <Badge tone="warning">{c.ageRestriction.replace("A", "")}+</Badge>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold">{t("packages.rounds")}</span>
            {c.rounds.map((r, i) => (
              <div
                key={i}
                className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-[12px] bg-surface-2 px-4 py-3"
              >
                <span className="font-medium [overflow-wrap:anywhere]">
                  {i + 1} · {r.name}
                </span>
                <span className="text-muted">
                  {r.type === "final"
                    ? t("packages.finalThemes", { count: r.themes.length })
                    : t("packages.roundCounts", {
                        themes: r.themes.length,
                        questions: r.themes.reduce((n, th) => n + th.questions.length, 0),
                      })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {parsed.warnings.length > 0 && <Warnings warnings={parsed.warnings} />}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="accent"
          size="lg"
          inactive={empty}
          disabled={empty}
          onClick={onUpload}
          className="sm:min-w-[240px]"
          icon={<UploadIcon size={20} />}
        >
          {t("upload.upload")}
        </Button>
        <Button size="lg" onClick={onEdit} icon={<EditIcon size={20} />} data-testid="upload-edit">
          {t("upload.editFirst")}
        </Button>
        <Button size="lg" variant="ghost" onClick={onCancel}>
          {t("upload.another")}
        </Button>
      </div>
      {empty && <p className="m-0 text-sm text-danger">{t("upload.noQuestions")}</p>}
    </div>
  );
}

const SHOWN_WARNINGS = 6;

function Warnings({ warnings }: { warnings: ImportWarning[] }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const shown = all ? warnings : warnings.slice(0, SHOWN_WARNINGS);
  return (
    <Card tone="raised" data-testid="upload-warnings">
      <div className="flex flex-col gap-3">
        <p className="m-0 font-semibold text-warning">
          {t("upload.warningsTitle", { count: warnings.length })}
        </p>
        <p className="m-0 text-sm text-soft">{t("upload.warningsHelp")}</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {shown.map((w, i) => (
            <li key={i} className="text-sm [overflow-wrap:anywhere]">
              {w.where && <span className="text-muted">{w.where} · </span>}
              {t(`upload.warnings.${w.code}`, { detail: w.detail ?? "" })}
            </li>
          ))}
        </ul>
        {warnings.length > SHOWN_WARNINGS && (
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => setAll((v) => !v)}
          >
            {all ? t("upload.showFewer") : t("upload.showAll", { count: warnings.length })}
          </Button>
        )}
      </div>
    </Card>
  );
}

function Progress({ title, progress }: { title: string; progress: UploadProgress }) {
  const { t } = useTranslation();
  const ratio =
    progress.phase === "creating"
      ? 0.03
      : progress.totalBytes > 0
        ? 0.05 + 0.95 * (progress.sentBytes / progress.totalBytes)
        : 1;
  const pct = Math.round(Math.min(1, ratio) * 100);
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
          {progress.phase === "creating"
            ? t("upload.creating")
            : t("upload.sending", {
                done: progress.done,
                total: progress.total,
                sent: formatBytes(progress.sentBytes),
                size: formatBytes(progress.totalBytes),
              })}
        </p>
        <p className="m-0 text-sm text-muted">{t("upload.keepOpen")}</p>
      </div>
    </Card>
  );
}

function uploadError(err: unknown, t: TFunction): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return t("upload.guestTitle");
    if (err.status === 401) return t("upload.signInFirst");
    if (err.status === 0) return t("upload.networkError");
    return t("upload.serverRejected", { message: err.message });
  }
  return err instanceof Error ? err.message : String(err);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
