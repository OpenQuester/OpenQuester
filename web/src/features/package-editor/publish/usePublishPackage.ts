import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ApiError } from "@/api/client";
import { useDiscordClientId } from "@/features/auth/discord";
import { useMe } from "@/features/auth/useMe";
import { useSettings } from "@/features/settings/settingsStore";
import { uploadPackage, type UploadProgress } from "@/features/upload/upload";
import { PointImageDimensionsError } from "@/features/upload/pointImageDimensions";
import { FinalMediaDurationError } from "@/features/upload/finalMediaDuration";
import { toParsed } from "../packageMedia";
import { usePackageEditor } from "../packageEditorStore";
import { playableNumericContent } from "../numericAnswer";

export type PublishStep =
  | { kind: "check" }
  | { kind: "uploading"; progress: UploadProgress }
  | { kind: "done"; id: number; failed: number; unfinished: boolean }
  | { kind: "failed"; error: string };

function publishError(err: unknown, replace: boolean, t: TFunction): string {
  if (err instanceof FinalMediaDurationError)
    return t(`upload.finalMedia.${err.reason}`, { name: err.fileName });
  if (err instanceof PointImageDimensionsError) return t("upload.pointImageDimensions");
  if (!(err instanceof ApiError)) return String(err);
  if (err.status === 0) return t("upload.networkError");
  if (err.status === 413 || err.status === 507) return err.message;
  if (err.status === 403 && replace) return t("editor.publish.notYours");
  return t("upload.serverRejected", { message: err.message });
}

export function usePublishPackage(setStep: (step: PublishStep) => void) {
  const { t } = useTranslation();
  const me = useMe();
  const discordClientId = useDiscordClientId();
  const qc = useQueryClient();
  const pkg = usePackageEditor((s) => s.pkg);
  const media = usePackageEditor((s) => s.media);
  const setPublished = usePackageEditor((s) => s.setPublished);
  const publishedId = usePackageEditor((s) => s.publishedId);
  const importWarnings = usePackageEditor((s) => s.importWarnings);

  /** With `replace`, saves over the package this draft was published as. */
  const publish = async (replace: boolean) => {
    try {
      const draft = toParsed(pkg, media);
      const parsed = { ...draft, content: playableNumericContent(draft.content) };
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
      setStep({ kind: "failed", error: publishError(err, replace, t) });
    }
  };

  return { me, discordClientId, publishedId, importWarnings, publish };
}
