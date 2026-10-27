import { useTranslation } from "react-i18next";

export function ShowmanInstruction({ comment }: { comment: string | null | undefined }) {
  const { t } = useTranslation();
  if (!comment) return null;
  return (
    <p className="m-0 text-sm text-soft" data-testid="showman-instruction">
      <strong>{t("showman.comment")}: </strong>
      {comment}
    </p>
  );
}
