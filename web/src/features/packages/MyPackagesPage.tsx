import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/app/AppShell";
import { useMe } from "@/features/auth/useMe";
import { timeAgo } from "@/lib/format";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { BackIcon, EditIcon, TrashIcon, UploadIcon } from "@/ui/icons";
import { Spinner } from "@/ui/Spinner";

import { StorageMeter } from "@/features/storage/StorageMeter";
import { PackageReports } from "@/features/stats/PackageReports";

import { useDeletePackage, useOpenInEditor } from "./packageActions";
import { NO_FILTERS, PAGE_SIZE, usePackages, type PackageCard } from "./usePackages";

/** The signed-in author's own packages: host, edit in the editor, delete. */
export function MyPackagesPage() {
  const { t } = useTranslation();
  const me = useMe();
  const [page, setPage] = useState(0);
  const authorId = me.data && !me.data.isGuest ? me.data.id : null;
  const packages = usePackages(
    { ...NO_FILTERS, title: "", sort: "newest", authorId },
    page,
    authorId != null,
  );

  if (me.isLoading)
    return (
      <PageContainer>
        <Spinner label={t("common.loading")} />
      </PageContainer>
    );
  if (!me.data) return <Navigate to="/login" search={{ redirect: "/packages/mine" }} />;

  const pages = Math.max(1, Math.ceil((packages.data?.total ?? 0) / PAGE_SIZE));

  return (
    <PageContainer width={1080}>
      <div className="flex flex-col gap-6">
        <Link
          to="/packages"
          className="inline-flex items-center gap-1.5 self-start text-muted no-underline hover:text-text"
        >
          <BackIcon size={18} />
          {t("nav.packages")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="m-0 font-display text-4xl font-extrabold tracking-tight">
            {t("myPackages.title")}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/packages/editor"
              className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-line-strong bg-surface-3 px-4 font-semibold text-text no-underline hover:bg-surface-2 hover:text-text"
            >
              <EditIcon size={18} />
              {t("packages.create")}
            </Link>
            <Link
              to="/packages/upload"
              className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-line-strong bg-surface-3 px-4 font-semibold text-text no-underline hover:bg-surface-2 hover:text-text"
            >
              <UploadIcon size={18} />
              {t("packages.upload")}
            </Link>
          </div>
        </div>

        {authorId != null && (
          <Card>
            <StorageMeter />
          </Card>
        )}

        {authorId == null ? (
          <Card data-testid="my-packages-guest">
            <p className="m-0 text-soft">{t("myPackages.guest")}</p>
          </Card>
        ) : packages.isLoading ? (
          <Spinner label={t("common.loading")} />
        ) : packages.isError ? (
          <p role="alert" className="text-danger">
            {t("packages.loadFailed")}
          </p>
        ) : packages.data?.items.length === 0 ? (
          <Card data-testid="my-packages-empty">
            <p className="m-0 text-soft">{t("myPackages.empty")}</p>
          </Card>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0" data-testid="my-packages">
            {packages.data?.items.map((p) => (
              <MyPackageRow key={p.id} pkg={p} />
            ))}
          </ul>
        )}

        {pages > 1 && (
          <div className="flex items-center gap-3">
            <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              {t("packages.prev")}
            </Button>
            <span className="text-sm text-muted">
              {t("packages.page", { page: page + 1, pages })}
            </span>
            <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
              {t("packages.next")}
            </Button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function MyPackageRow({ pkg }: { pkg: PackageCard }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { opening, error, open } = useOpenInEditor();
  const del = useDeletePackage();
  const [confirm, setConfirm] = useState(false);

  return (
    <li
      className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-line bg-surface p-4 sm:p-5"
      data-testid="my-package"
    >
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
        <button
          type="button"
          className="self-start text-left text-lg font-semibold text-text [overflow-wrap:anywhere] hover:text-accent"
          onClick={() => void navigate({ to: "/packages", search: { id: pkg.id } })}
        >
          {pkg.title}
        </button>
        <span className="text-sm text-muted">
          {pkg.roundsCount != null &&
            `${t("packages.counts", { rounds: pkg.roundsCount, questions: pkg.questionsCount ?? 0 })} · `}
          {t("myPackages.published", { when: timeAgo(pkg.createdAt) })}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {pkg.language && <Badge>{pkg.language.toUpperCase()}</Badge>}
          {pkg.ageRestriction && pkg.ageRestriction !== "NONE" && (
            <Badge tone="warning">{pkg.ageRestriction.replace("A", "")}+</Badge>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/games/new"
          search={{ packageId: pkg.id }}
          className="inline-flex min-h-11 items-center rounded-[12px] bg-accent px-4 font-semibold text-on-accent no-underline hover:text-on-accent"
        >
          {t("myPackages.host")}
        </Link>
        <Button
          icon={<EditIcon size={18} />}
          disabled={opening}
          onClick={() => void open(pkg.id)}
          data-testid="my-package-edit"
        >
          {opening ? t("myPackages.opening") : t("myPackages.edit")}
        </Button>
        <PackageReports packageId={pkg.id} title={pkg.title} />
        {confirm ? (
          <>
            <Button
              variant="danger"
              disabled={del.isPending}
              onClick={() => del.mutate(pkg.id)}
              data-testid="my-package-delete-confirm"
            >
              {t("myPackages.confirmDelete")}
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {t("common.cancel")}
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            icon={<TrashIcon size={18} />}
            onClick={() => setConfirm(true)}
            data-testid="my-package-delete"
          >
            {t("myPackages.delete")}
          </Button>
        )}
      </div>
      {confirm && <p className="m-0 w-full text-sm text-muted">{t("myPackages.deleteHelp")}</p>}
      {(error || del.isError) && (
        <p role="alert" className="m-0 w-full text-sm text-danger">
          {error ?? t("myPackages.deleteFailed")}
        </p>
      )}
    </li>
  );
}
