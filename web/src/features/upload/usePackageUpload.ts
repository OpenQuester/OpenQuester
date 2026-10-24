import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ApiError } from "@/api/client";
import { useSettings } from "@/features/settings/settingsStore";
import type { ParsedPackage } from "./types";
import {
  RESUME_OTHER_SOURCE,
  contentHash,
  readPackageFile,
  resumeFromFile,
  resumeUpload,
  uploadPackage,
  type PendingFile,
  type UploadProgress,
  type UploadResult,
  type UploadState,
} from "./upload";
import { useUploadWarning } from "./useUploadWarning";

export type UploadStep =
  | { kind: "pick"; error?: string }
  | { kind: "reading"; name: string }
  | { kind: "review"; name: string; parsed: ParsedPackage; editing?: boolean; error?: string }
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

export function usePackageUpload() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<UploadStep>({ kind: "pick" });

  useUploadWarning(step.kind === "uploading");

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

  async function edit(parsed: ParsedPackage, name: string) {
    setStep({ kind: "review", parsed, name, editing: true });
    try {
      const { draftFromParsed } = await import("@/features/package-editor/createDraft");
      const draftId = await draftFromParsed(parsed);
      await navigate({ to: "/packages/editor/$draftId", params: { draftId } });
    } catch (err) {
      setStep({ kind: "review", parsed, name, error: uploadError(err, t) });
    }
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

  return { step, pick, upload, resume, edit, retry, reset: () => setStep({ kind: "pick" }) };
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
