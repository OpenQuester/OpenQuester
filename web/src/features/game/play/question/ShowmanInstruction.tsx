import { useTranslation } from "react-i18next";

export function ShowmanInstruction({ comment }: { comment: string | null | undefined }) {
  const { t } = useTranslation();
  if (!comment) return null;
  return (
    <p
      className="m-0 min-w-0 max-w-full text-sm whitespace-pre-wrap text-soft [overflow-wrap:anywhere]"
      data-testid="showman-instruction"
    >
      <strong>{t("showman.comment")}: </strong>
      {comment}
    </p>
  );
}
