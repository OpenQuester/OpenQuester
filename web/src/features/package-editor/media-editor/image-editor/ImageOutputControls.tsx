import { MediaRange, mediaControlStyles } from "../MediaControls";
import { useTranslation } from "react-i18next";
import { inputClass } from "@/ui/Field";
import type { ImageEdits } from "../mediaEdits";
export function ImageOutputControls({
  blur,
  quality,
  blurSupported,
  onBlurChange,
  onFinish,
  onQualityChange,
}: {
  blur: number;
  quality: ImageEdits["quality"];
  blurSupported: boolean;
  onBlurChange: (blur: number) => void;
  onFinish: () => void;
  onQualityChange: (quality: ImageEdits["quality"]) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <MediaRange
        label={
          <>
            {t("mediaEditor.wholeBlur")}: {blur}
          </>
        }
        min={0}
        max={60}
        value={blur}
        disabled={!blurSupported}
        onChange={(e) => onBlurChange(+e.target.value)}
        onFinish={onFinish}
      />
      {!blurSupported && (
        <p className="m-0 text-sm text-warning">{t("mediaEditor.errors.blurUnsupported")}</p>
      )}
      <label className={mediaControlStyles.label}>
        {t("mediaEditor.quality")}
        <select
          className={inputClass}
          value={quality}
          onChange={(e) => onQualityChange(e.target.value as ImageEdits["quality"])}
        >
          {(["small", "balanced", "high"] as const).map((q) => (
            <option key={q} value={q}>
              {t(`mediaEditor.${q}`)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
