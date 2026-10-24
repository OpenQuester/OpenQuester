import { mediaEditorStyles } from "../mediaEditorStyles";
import { useTranslation } from "react-i18next";
import type { AudioVideoEditorState } from "./useAudioVideoEditor";
import { inputClass } from "@/ui/Field";
import { formatTime } from "../mediaEdits";
import { TimeInput } from "./TimeInput";
export function AudioVideoSettings({ editor }: { editor: AudioVideoEditorState }) {
  const { t } = useTranslation();
  const { edits, supported, update, finish, video, meta, valid, visualError } = editor;
  if (!meta || !edits) return null;
  return (
    <aside className={mediaEditorStyles.audioVideoSettings}>
      <div>
        <h3 className="m-0 font-semibold">{t("mediaEditor.trimTitle")}</h3>
        <p className="mt-1 mb-0 text-sm text-muted">{t("mediaEditor.trimHelp")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {(["start", "end"] as const).map((key) => (
          <div key={key} className="flex min-w-0 flex-col gap-1">
            <TimeInput
              label={t(key === "start" ? "mediaEditor.startTime" : "mediaEditor.endTime")}
              value={edits[key]}
              disabled={!supported}
              onChange={(value) => update({ [key]: value }, true)}
              onFinish={finish}
            />
          </div>
        ))}
      </div>
      <p className={mediaEditorStyles.duration} role="status">
        {t("mediaEditor.duration", { duration: formatTime(edits.end - edits.start) || "—" })}
      </p>
      {video && !meta.hasAudio && (
        <p className="m-0 text-sm text-muted">{t("mediaEditor.noAudio")}</p>
      )}
      {!video && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {(["fadeIn", "fadeOut"] as const).map((key) => (
              <label key={key} className="flex min-w-0 flex-col gap-2 text-sm">
                {t(key === "fadeIn" ? "mediaEditor.fadeIn" : "mediaEditor.fadeOut")}
                <span className="flex min-w-0 items-center gap-1 text-muted">
                  <input
                    type="number"
                    disabled={!supported || !valid}
                    className={inputClass + " w-full px-2"}
                    min={0}
                    max={valid ? edits.end - edits.start : undefined}
                    step={0.01}
                    value={Number(edits[key].toFixed(3))}
                    aria-label={t(
                      key === "fadeIn" ? "mediaEditor.fadeInSeconds" : "mediaEditor.fadeOutSeconds",
                    )}
                    onChange={(e) => update({ [key]: +e.target.value }, true)}
                    onBlur={finish}
                  />
                  {t("mediaEditor.secondsUnit")}
                </span>
              </label>
            ))}
          </div>
          <p className="m-0 text-sm text-muted">{t("mediaEditor.fadeHelp")}</p>
        </>
      )}
      {!valid && (
        <p role="alert" className="m-0 text-danger">
          {t("mediaEditor.errors.trim")}
        </p>
      )}
      {!supported && (
        <p role="status" className="m-0 text-warning">
          {t("mediaEditor.errors.unsupported")}
        </p>
      )}
      {visualError && (
        <p role="status" className="m-0 text-muted">
          {t("mediaEditor.visualUnavailable")}
        </p>
      )}
    </aside>
  );
}
