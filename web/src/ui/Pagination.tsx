import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/Button";

export function Pagination({
  page,
  pages,
  setPage,
}: {
  page: number;
  pages: number;
  setPage: Dispatch<SetStateAction<number>>;
}) {
  const { t } = useTranslation();
  return (
    (pages > 1 || page > 0) && (
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, Math.min(p - 1, pages - 1)))}
        >
          {t("packages.prev")}
        </Button>
        {page < pages && (
          <span className="text-sm text-muted">
            {t("packages.page", { page: page + 1, pages })}
          </span>
        )}
        <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
          {t("packages.next")}
        </Button>
      </div>
    )
  );
}
