import { useTranslation } from "react-i18next";

export function MediaCompressionNotice() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1" data-testid="compression-notice">
      <p className="m-0 font-medium">{t("upload.compress.label")}</p>
      <p className="m-0 text-sm text-muted">{t("upload.compress.help")}</p>
    </div>
  );
}
