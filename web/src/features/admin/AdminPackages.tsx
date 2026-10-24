import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { User } from "@/api/types";
import { useDeletePackage, useOpenInEditor } from "@/features/packages/packageActions";
import {
  NO_FILTERS,
  PAGE_SIZE,
  usePackages,
  type PackageCard,
  type PackageFilters,
} from "@/features/packages/usePackages";
import { timeAgo } from "@/lib/format";
import { Button } from "@/ui/Button";
import { TextInput } from "@/ui/Field";
import { Spinner } from "@/ui/Spinner";

import { can } from "./useAdmin";

/** Every published package, with edit and delete for staff who hold those permissions. */
export function AdminPackages({ me }: { me: User }) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [filters, setFilters] = useState<PackageFilters>({
    ...NO_FILTERS,
    title: "",
    sort: "newest",
  });
  const [page, setPage] = useState(0);
  const packages = usePackages(filters, page);
  const remove = useDeletePackage();
  const editor = useOpenInEditor();

  useEffect(() => {
    const id = window.setTimeout(() => {
      setFilters((f) => (f.title === input ? f : { ...f, title: input }));
      setPage(0);
    }, 250);
    return () => window.clearTimeout(id);
  }, [input]);

  const pages = Math.max(1, Math.ceil((packages.data?.total ?? 0) / PAGE_SIZE));
  const failure = remove.error ?? (editor.error ? new Error(editor.error) : null);

  return (
    <div className="flex flex-col gap-5" data-testid="admin-packages">
      <label htmlFor="adm-pkg-search" className="sr-only">
        {t("packages.search")}
      </label>
      <TextInput
        id="adm-pkg-search"
        type="search"
        value={input}
        placeholder={t("packages.search")}
        onChange={(e) => setInput(e.target.value)}
        className="bg-surface"
      />
      {failure && (
        <p role="alert" className="m-0 text-danger">
          {failure instanceof Error ? failure.message : t("adminPanel.actionFailed")}
        </p>
      )}
      {packages.isLoading ? (
        <Spinner label={t("common.loading")} />
      ) : packages.isError ? (
        <p role="alert" className="text-danger">
          {t("adminPanel.loadFailed")}
        </p>
      ) : packages.data?.items.length === 0 ? (
        <p className="m-0 text-muted">{t("adminPanel.noPackages")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {packages.data?.items.map((p) => (
            <PackageRow
              key={p.id}
              pkg={p}
              canEdit={can(me, "edit_package") || p.author.id === me.id}
              canDelete={can(me, "delete_package") || p.author.id === me.id}
              busy={remove.isPending || editor.opening}
              onEdit={() => void editor.open(p.id)}
              onDelete={() => remove.mutate(p.id)}
            />
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="flex items-center gap-3">
          <Button size="sm" disabled={page === 0} onClick={() => setPage((x) => x - 1)}>
            {t("packages.prev")}
          </Button>
          <span className="text-sm text-muted">
            {t("packages.page", { page: page + 1, pages })}
          </span>
          <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((x) => x + 1)}>
            {t("packages.next")}
          </Button>
        </div>
      )}
    </div>
  );
}

function PackageRow({
  pkg,
  canEdit,
  canDelete,
  busy,
  onEdit,
  onDelete,
}: {
  pkg: PackageCard;
  canEdit: boolean;
  canDelete: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  return (
    <li
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md border border-line bg-surface px-4 py-3"
      data-testid="admin-package"
    >
      <div className="flex min-w-0 flex-[1_1_240px] flex-col">
        <span className="truncate font-semibold">{pkg.title}</span>
        <span className="truncate text-sm text-muted">
          #{pkg.id} · {t("adminPanel.byAuthor", { name: pkg.author.username })} ·{" "}
          {timeAgo(pkg.createdAt)}
          {pkg.roundsCount != null &&
            ` · ${t("adminPanel.packageSize", { rounds: pkg.roundsCount, questions: pkg.questionsCount ?? 0 })}`}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Button size="sm" disabled={busy} onClick={onEdit}>
            {t("adminPanel.edit")}
          </Button>
        )}
        {canDelete &&
          (confirm ? (
            <>
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => {
                  setConfirm(false);
                  onDelete();
                }}
              >
                {t("adminPanel.confirmDelete")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                {t("common.cancel")}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              aria-label={t("adminPanel.deleteNamed", { name: pkg.title })}
              onClick={() => setConfirm(true)}
            >
              {t("adminPanel.delete")}
            </Button>
          ))}
      </div>
    </li>
  );
}
