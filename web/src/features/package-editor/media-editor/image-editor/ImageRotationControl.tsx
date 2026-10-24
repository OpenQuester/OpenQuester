import { mediaControlStyles } from "../MediaControls";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { useState } from "react";
import { inputClass } from "@/ui/Field";
import { ReplayIcon } from "@/ui/icons";
export function ImageRotationControl({
  rotation,
  onChange,
  onFinish,
}: {
  rotation: number;
  onChange: (rotation: number, transient?: boolean) => void;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  const [rotationInput, setRotationInput] = useState<string | null>(null);

  return (
    <div className={mediaControlStyles.label}>
      <span>{t("mediaEditor.rotation")}</span>
      <div className="flex min-w-0 items-center gap-2">
        <Button
          className={mediaControlStyles.fixedIconButton}
          aria-label={t("mediaEditor.rotateLeft")}
          title={t("mediaEditor.rotateLeft")}
          onClick={() => onChange(rotation - 90)}
        >
          <ReplayIcon />
        </Button>
        <input
          type="number"
          step="any"
          className={inputClass + " w-0 flex-1 text-center tabular-nums"}
          aria-label={t("mediaEditor.rotation")}
          value={rotationInput ?? rotation}
          onFocus={() => setRotationInput(String(rotation))}
          onChange={(e) => {
            setRotationInput(e.target.value);
            if (Number.isFinite(e.target.valueAsNumber)) onChange(e.target.valueAsNumber, true);
          }}
          onBlur={() => {
            setRotationInput(null);
            onFinish();
          }}
        />
        <Button
          className={mediaControlStyles.fixedIconButton}
          aria-label={t("mediaEditor.rotateRight")}
          title={t("mediaEditor.rotateRight")}
          onClick={() => onChange(rotation + 90)}
        >
          <span className="-scale-x-100">
            <ReplayIcon />
          </span>
        </Button>
      </div>
    </div>
  );
}
