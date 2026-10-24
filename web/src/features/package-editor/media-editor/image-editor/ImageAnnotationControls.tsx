import { MediaRange, mediaControlStyles } from "../MediaControls";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import type { DrawingTool, ImageAnnotation } from "../mediaEdits";
import { inputClass } from "@/ui/Field";
export function ImageAnnotationControls({
  propertyTool,
  showText,
  color,
  size,
  text,
  annotations,
  selected,
  onColor,
  onSize,
  onText,
  onSelect,
  onDelete,
  onFinish,
}: {
  propertyTool: DrawingTool | null;
  showText: boolean;
  color: string;
  size: number;
  text: string;
  annotations: ImageAnnotation[];
  selected: string | null;
  onColor: (color: string) => void;
  onSize: (size: number) => void;
  onText: (text: string) => void;
  onSelect: (id: string | null) => void;
  onDelete: () => void;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {propertyTool && propertyTool !== "blur" && (
        <label className="flex items-center justify-between gap-2 text-sm">
          {t("mediaEditor.color")}
          <input
            type="color"
            className="h-11 w-16"
            value={color}
            onChange={(e) => onColor(e.target.value)}
          />
        </label>
      )}
      {propertyTool && (
        <MediaRange
          label={t(
            propertyTool === "text"
              ? "mediaEditor.textSize"
              : propertyTool === "blur"
                ? "mediaEditor.strength"
                : "mediaEditor.stroke",
          )}
          min={1}
          max={propertyTool === "text" ? 120 : 60}
          value={size}
          onChange={(e) => onSize(+e.target.value)}
          onFinish={onFinish}
        />
      )}
      {showText && (
        <label className={mediaControlStyles.label}>
          {t("mediaEditor.text")}
          <input
            className={inputClass}
            value={text}
            onChange={(e) => onText(e.target.value)}
            onBlur={onFinish}
          />
        </label>
      )}
      {annotations.length > 0 && (
        <label className={mediaControlStyles.label}>
          {t("mediaEditor.annotation")}
          <select
            className={inputClass}
            value={selected ?? ""}
            onChange={(e) => onSelect(e.target.value || null)}
          >
            <option value="">{t("mediaEditor.select")}</option>
            {annotations.map((a, i) => (
              <option key={a.id} value={a.id}>
                {i + 1}. {t(`mediaEditor.${a.tool}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      {selected && <Button onClick={onDelete}>{t("mediaEditor.delete")}</Button>}
    </>
  );
}
