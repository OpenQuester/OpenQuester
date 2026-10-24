import { typographyStyles } from "@/ui/typographyStyles";
import { useTranslation } from "react-i18next";
import { Card } from "@/ui/Card";
import { CheckIcon } from "@/ui/icons";
import { UploadResultLinks } from "./UploadResultLinks";

export function ResumeUploadResult({ id, totalFiles }: { id: number; totalFiles: number }) {
  const { t } = useTranslation();
  return (
    <Card tone="accent" data-testid="resume-done">
      <div className="flex flex-col gap-4">
        <p className={typographyStyles.sectionTitleWithIcon}>
          <CheckIcon size={26} />
          {t("resume.done")}
        </p>
        <p className="m-0 text-soft">{t("resume.doneHelp", { count: totalFiles })}</p>
        <div className="flex flex-wrap gap-3">
          <UploadResultLinks id={id} />
        </div>
      </div>
    </Card>
  );
}
