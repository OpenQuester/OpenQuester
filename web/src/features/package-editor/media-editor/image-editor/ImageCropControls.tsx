import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import type { ImageCrop } from "../mediaEdits";
import { inputClass } from "@/ui/Field";
export function ImageCropControls({
  crop,
  canApply,
  canReset,
  onChange,
  onApply,
  onReset,
}: {
  crop: ImageCrop;
  canApply: boolean;
  canReset: boolean;
  onChange: (crop: ImageCrop) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <p className="m-0 text-sm text-muted">{t("mediaEditor.cropHelp")}</p>
      <div className="grid grid-cols-2 gap-2">
        {(["x", "y", "width", "height"] as const).map((key) => (
          <label key={key} className="flex min-w-0 flex-col gap-1 text-sm">
            {t(`mediaEditor.crop${key}`)}
            <input
              type="number"
              className={inputClass}
              min={0}
              max={100}
              step={1}
              value={Number((crop[key] * 100).toFixed(2))}
              onChange={(e) => {
                const next = {
                  ...crop,
                  [key]: Math.max(0, Math.min(1, +e.target.value / 100)),
                };
                next.width = Math.min(next.width, 1 - next.x);
                next.height = Math.min(next.height, 1 - next.y);
                onChange(next);
              }}
            />
          </label>
        ))}
      </div>
      <Button variant="accent" disabled={!canApply} onClick={onApply}>
        {t("mediaEditor.applyCrop")}
      </Button>
      <Button disabled={!canReset} onClick={onReset}>
        {t("mediaEditor.resetCrop")}
      </Button>
    </>
  );
}
