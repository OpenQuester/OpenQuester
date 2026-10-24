import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { PageContainer } from "@/app/AppShell";
import { ApiError } from "@/api/client";
import { startDiscordLogin, useDiscordClientId } from "@/features/auth/discord";
import { useMe } from "@/features/auth/useMe";
import { cn } from "@/lib/cn";
import { formatBytes, timeAgo } from "@/lib/format";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { AlertIcon, BackIcon, CheckIcon, EditIcon, UploadIcon } from "@/ui/icons";
import { Spinner } from "@/ui/Spinner";

import { Toggle } from "@/features/settings/SettingsPage";
import { useSettings } from "@/features/settings/settingsStore";
import { StorageMeter } from "@/features/storage/StorageMeter";

import type { ParsedPackage } from "./types";
import {
  ACCEPT,
  RESUME_OTHER_SOURCE,
  contentHash,
  describe,
  findDuplicates,
  readPackageFile,
  resumeFromFile,
  resumeUpload,
  uploadPackage,
  type PendingFile,
  type UploadProgress,
  type UploadResult,
  type UploadState,
} from "./upload";
import { UploadProgressCard } from "./UploadProgressCard";
import { ImportWarnings } from "./ImportWarnings";

type Step =
  | { kind: "pick"; error?: string }
  | { kind: "reading"; name: string }
  | { kind: "review"; name: string; parsed: ParsedPackage }
  | { kind: "uploading"; parsed: ParsedPackage; progress: UploadProgress }
  | {
      kind: "partial";
      parsed: ParsedPackage;
      id: number;
      failed: PendingFile[];
      state: UploadState | null;
    }
  | { kind: "done"; id: number; title: string; savings?: { before: number; after: number } }
  | { kind: "failed"; parsed: ParsedPackage; name: string; error: string };

export function UploadPackagePage() {
  const { t } = useTranslation();
  const me = useMe();
  const discordClientId = useDiscordClientId();
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

  /** Done only when the server confirms every file; anything else can be resumed. */
  function finish(parsed: ParsedPackage, result: UploadResult) {
    const { id, failed, savings, state } = result;
    void qc.invalidateQueries({ queryKey: ["packages"] });
    void qc.invalidateQueries({ queryKey: ["package", id] });
    void qc.invalidateQueries({ queryKey: ["package-upload", id] });
    void qc.invalidateQueries({ queryKey: ["me", "storage"] });
    // No answer from the final status check proves nothing (skipped archive files
    // never enter `failed`), so the upload stays resumable
    const complete = state !== null && state.status === "ready";
    setStep(
      complete
        ? { kind: "done", id, title: parsed.content.title, savings }
        : { kind: "partial", parsed, id, failed, state },
    );
  }

  async function upload(parsed: ParsedPackage, name: string) {
    const onProgress = (progress: UploadProgress) =>
      setStep({ kind: "uploading", parsed, progress });
    try {
      finish(
        parsed,
        await uploadPackage(
          parsed,
          onProgress,
          undefined,
          useSettings.getState().compressMedia,
          contentHash(parsed),
        ),
      );
    } catch (err) {
      setStep({ kind: "failed", parsed, name, error: uploadError(err, t) });
    }
  }

  /** Finishes an earlier upload of this same file instead of creating a copy. */
  async function resume(parsed: ParsedPackage, name: string, id: number) {
    try {
      finish(
        parsed,
        await resumeFromFile(
          id,
          parsed,
          (progress) => setStep({ kind: "uploading", parsed, progress }),
          useSettings.getState().compressMedia,
        ),
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
    // Fresh links from the server: the first ones may have expired.
    const files = new Map(parsed.files);
    for (const p of pending) files.set(p.file.md5, p.file);
    try {
      finish(
        parsed,
        await resumeUpload(id, files, (progress) =>
          setStep({ kind: "uploading", parsed, progress }),
        ),
      );
    } catch {
      setStep({ kind: "partial", parsed, id, failed: pending, state: null });
    }
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
              {discordClientId ? (
                <Button
                  variant="primary"
                  size="lg"
                  className="sm:self-start"
                  onClick={() => void startDiscordLogin(discordClientId, "/packages/upload")}
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
            onResume={(id) => void resume(step.parsed, step.name, id)}
            onEdit={() => void edit(step.parsed)}
            onCancel={() => setStep({ kind: "pick" })}
          />
        ) : step.kind === "uploading" ? (
          <UploadProgressCard title={step.parsed.content.title} progress={step.progress} />
        ) : step.kind === "partial" ? (
          <Card data-testid="upload-partial">
            <div className="flex flex-col gap-4">
              <p role="alert" className="m-0 font-semibold text-warning">
                {step.state
                  ? t("upload.unfinished", {
                      uploaded: step.state.uploadedFiles,
                      total: step.state.totalFiles,
                    })
                  : t("upload.partial", { count: step.failed.length })}
              </p>
              <p className="m-0 text-soft">{t("upload.unfinishedHelp")}</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="accent"
                  size="lg"
                  onClick={() => void retry(step.parsed, step.id, step.failed)}
                >
                  {t("upload.retryFiles")}
                </Button>
                <Link
                  to="/packages/mine"
                  className="flex min-h-14 items-center rounded-md border border-line-strong px-6 font-semibold text-text no-underline hover:text-text"
                >
                  {t("upload.resumeLater")}
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
              {step.savings && step.savings.after < step.savings.before && (
                <p className="m-0 text-sm text-muted" data-testid="upload-savings">
                  {t("upload.compress.saved", {
                    before: formatBytes(step.savings.before),
                    after: formatBytes(step.savings.after),
                  })}
                </p>
              )}
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

export function DropZone({ onFile, error }: { onFile: (f: File) => void; error?: string }) {
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
  onResume,
  onEdit,
  onCancel,
}: {
  parsed: ParsedPackage;
  name: string;
  onUpload: () => void;
  onResume: (id: number) => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const c = parsed.content;
  const totals = describe(parsed);
  const empty = totals.questions === 0;
  const duplicates = useDuplicates(parsed);
  const hasDuplicates = (duplicates.data?.length ?? 0) > 0;
  return (
    <div className="flex flex-col gap-5" data-testid="upload-review">
      {/* First, so nobody scrolls past it to the upload button. */}
      {hasDuplicates && <Duplicates packages={duplicates.data ?? []} onResume={onResume} />}
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

      {parsed.warnings.length > 0 && <ImportWarnings warnings={parsed.warnings} />}

      {totals.mediaCount > 0 && <CompressToggle />}
      {totals.mediaCount > 0 && <StorageMeter />}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant={hasDuplicates ? "secondary" : "accent"}
          size="lg"
          inactive={empty}
          disabled={empty}
          onClick={onUpload}
          className="sm:min-w-[240px]"
          icon={<UploadIcon size={20} />}
        >
          {hasDuplicates ? t("upload.uploadAnyway") : t("upload.upload")}
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

interface Duplicate {
  id: number;
  title: string;
  createdAt: string;
  author: { id: number; username: string };
  uploadStatus?: "uploading" | "ready";
}

/** Packages already uploaded from this same file, so nobody makes a copy by accident. */
function useDuplicates(parsed: ParsedPackage) {
  const hash = contentHash(parsed);
  return useQuery({
    queryKey: ["package-duplicates", hash],
    queryFn: async () => (await findDuplicates(hash)) as unknown as Duplicate[],
    staleTime: 0,
  });
}

function Duplicates({
  packages,
  onResume,
}: {
  packages: Duplicate[];
  onResume: (id: number) => void;
}) {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <Card tone="raised" data-testid="upload-duplicates">
      <div className="flex flex-col gap-3">
        <p className="m-0 flex items-center gap-2 font-semibold text-warning">
          <AlertIcon size={20} />
          {t("upload.duplicates.title", { count: packages.length })}
        </p>
        <p className="m-0 text-sm text-soft">{t("upload.duplicates.help")}</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {packages.map((p) => {
            const mine = p.author.id === me.data?.id;
            const unfinished = p.uploadStatus === "uploading";
            return (
              <li
                key={p.id}
                data-testid="upload-duplicate"
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] bg-surface-2 px-4 py-3"
              >
                <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                  <span className="font-semibold [overflow-wrap:anywhere]">{p.title}</span>
                  <span className="text-sm text-muted">
                    {mine
                      ? t("upload.duplicates.yours", { when: timeAgo(p.createdAt) })
                      : t("upload.duplicates.by", {
                          author: p.author.username,
                          when: timeAgo(p.createdAt),
                        })}
                  </span>
                  {unfinished && (
                    <Badge tone="warning" className="self-start">
                      {t("packages.uploadUnfinished")}
                    </Badge>
                  )}
                </div>
                {unfinished && mine ? (
                  <Button variant="accent" onClick={() => onResume(p.id)}>
                    {t("upload.duplicates.resume")}
                  </Button>
                ) : (
                  <Link
                    to="/packages"
                    search={{ id: p.id }}
                    className="inline-flex min-h-11 items-center rounded-[12px] bg-accent px-4 font-semibold text-on-accent no-underline hover:text-on-accent"
                  >
                    {t("upload.duplicates.open")}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

/** Whether media is re-encoded before upload; remembered on this device. */
export function CompressToggle() {
  const { t } = useTranslation();
  const on = useSettings((s) => s.compressMedia);
  const update = useSettings((s) => s.update);
  return (
    <div className="flex flex-col gap-1" data-testid="compress-toggle">
      <Toggle
        label={t("upload.compress.label")}
        checked={on}
        onChange={(v) => update({ compressMedia: v })}
      />
      <p className="m-0 text-sm text-muted">{t("upload.compress.help")}</p>
    </div>
  );
}

function uploadError(err: unknown, t: TFunction): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return t("upload.guestTitle");
    if (err.status === 401) return t("upload.signInFirst");
    if (err.status === 0) return t("upload.networkError");
    // Storage limits: the server says which limit and by how much.
    if (err.status === 413 || err.status === 507 || err.status === 409) return err.message;
    return t("upload.serverRejected", { message: err.message });
  }
  if (err instanceof Error && err.message === RESUME_OTHER_SOURCE)
    return t("upload.readErrors.otherSource");
  return err instanceof Error ? err.message : String(err);
}
