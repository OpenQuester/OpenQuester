import { mediaEditorStyles } from "./mediaEditorStyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import type { MediaEditorProps } from "./mediaEditorTypes";
import type { MediaSessionState } from "./useMediaSession";
export function MediaEditorFooter({
  session,
  index,
  total,
  onClose,
  onSkip,
}: Pick<MediaEditorProps, "index" | "total" | "onClose" | "onSkip"> & {
  session: MediaSessionState;
}) {
  const { t } = useTranslation();
  const {
    loaded,
    status,
    progress,
    busy,
    failure,
    confirm,
    cancelButtonRef,
    keepButtonRef,
    requestClose,
    save,
    retryProcessing,
    keepEditing,
    addRemaining,
  } = session;
  return (
    <footer className={mediaEditorStyles.footer}>
      {failure && (
        <div className={mediaEditorStyles.failure} role="alert">
          <span>
            {t(
              `mediaEditor.errors.${["mediaSize", "mediaType", "unsupported", "downloadFailed", "downloadCorrupt"].includes(failure) ? failure : "processingFailed"}`,
            )}
          </span>
          {!busy && <Button onClick={retryProcessing}>{t("mediaEditor.retry")}</Button>}
        </div>
      )}
      {confirm ? (
        <>
          <span className="flex-1 text-warning" role="alert">
            {t("mediaEditor.discardPrompt")}
          </span>
          <Button variant="danger" onClick={onClose}>
            {t("editor.form.discard")}
          </Button>
          <Button ref={keepButtonRef} onClick={keepEditing}>
            {t("editor.form.keepEditing")}
          </Button>
        </>
      ) : busy ? (
        <>
          <Button onClick={requestClose}>{t("mediaEditor.cancelProcessing")}</Button>
          <progress
            className="min-w-0 flex-1"
            max={1}
            value={progress ?? undefined}
            aria-label={t("mediaEditor.processing")}
          />
          <span role="status">{t("mediaEditor.processing")}</span>
        </>
      ) : (
        <>
          <Button ref={cancelButtonRef} onClick={requestClose}>
            {t("editor.cancel")}
          </Button>
          {total > 1 && (
            <>
              <Button onClick={onSkip}>{t("mediaEditor.skip")}</Button>
              <Button onClick={addRemaining}>{t("mediaEditor.remaining")}</Button>
            </>
          )}
          <span className="flex-1" />
          <Button disabled={!loaded} onClick={() => void save(true)}>
            {t("mediaEditor.unchanged")}
          </Button>
          <Button
            variant="accent"
            disabled={!status.ready || !loaded}
            onClick={() => void save()}
            data-testid="media-save"
          >
            {t(index + 1 < total ? "mediaEditor.saveNext" : "mediaEditor.save")}
          </Button>
        </>
      )}
    </footer>
  );
}
