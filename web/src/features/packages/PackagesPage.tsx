import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/app/AppShell";
import type { OqPackage } from "@/api/types";
import { useMe } from "@/features/auth/useMe";
import { LANGUAGES } from "@/i18n";
import { Badge } from "@/ui/Badge";
import { Dialog } from "@/ui/Dialog";
import { Button } from "@/ui/Button";
import { Select, TextInput } from "@/ui/Field";
import { EditIcon, TrashIcon, UploadIcon, EyeIcon } from "@/ui/icons";
import { Spinner } from "@/ui/Spinner";

import {
  extraFilterCount,
  NO_FILTERS,
  PAGE_SIZE,
  summarize,
  usePackage,
  usePackages,
  type PackageCard,
  type PackageFilters,
  type PackageSort,
} from "./usePackages";
import { useDeletePackage, useOpenInEditor } from "./packageActions";

export function PackagesPage() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/shell/packages" });
  const navigate = useNavigate({ from: "/packages" });
  const [query, setQuery] = useState(search.q ?? "");
  const [filters, setFilters] = useState<PackageFilters>({
    ...NO_FILTERS,
    title: search.q ?? "",
    sort: "newest",
  });
  const [showMore, setShowMore] = useState(false);
  const me = useMe();
  const change = (patch: Partial<PackageFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };
  const extra = extraFilterCount(filters);
  const [page, setPage] = useState(0);
  const packages = usePackages(filters, page);
  const selectedId = search.id ?? null;

  // Debounce typing into the search box.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setFilters((f) => (f.title === query ? f : { ...f, title: query }));
      setPage(0);
    }, 250);
    return () => window.clearTimeout(id);
  }, [query]);

  const select = (id: number | undefined) =>
    void navigate({ search: (s) => ({ ...s, id }), replace: true });
  const pages = Math.max(1, Math.ceil((packages.data?.total ?? 0) / PAGE_SIZE));

  return (
    <PageContainer width={1320}>
      <div className="flex flex-col gap-6">
        <section className="flex min-w-0 flex-col gap-5" aria-labelledby="pk-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 id="pk-title" className="m-0 font-display text-4xl font-extrabold tracking-tight">
              {t("packages.title")}
            </h1>
            <div className="flex flex-wrap gap-2">
              {me.data && !me.data.isGuest && (
                <Link
                  to="/packages/mine"
                  className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-line-strong bg-surface-3 px-4 font-semibold text-text no-underline hover:bg-surface-2 hover:text-text"
                >
                  {t("myPackages.link")}
                </Link>
              )}
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
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="pk-search" className="sr-only">
              {t("packages.search")}
            </label>
            <TextInput
              id="pk-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("packages.search")}
              className="flex-[1_1_260px] bg-surface"
            />
            <label htmlFor="pk-lang" className="text-sm text-muted">
              {t("packages.language")}
            </label>
            <Select
              id="pk-lang"
              className="w-auto bg-surface"
              value={filters.language}
              onChange={(e) => {
                setFilters((f) => ({ ...f, language: e.target.value }));
                setPage(0);
              }}
            >
              <option value="">{t("packages.anyLanguage")}</option>
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
            <label htmlFor="pk-sort" className="text-sm text-muted">
              {t("packages.sort")}
            </label>
            <Select
              id="pk-sort"
              className="w-auto bg-surface"
              value={filters.sort}
              onChange={(e) => change({ sort: e.target.value as PackageSort })}
            >
              <option value="newest">{t("packages.sortNewest")}</option>
              <option value="oldest">{t("packages.sortOldest")}</option>
              <option value="title">{t("packages.sortTitle")}</option>
              <option value="titleDesc">{t("packages.sortTitleDesc")}</option>
              <option value="author">{t("packages.sortAuthor")}</option>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={showMore}
              aria-controls="pk-more"
              onClick={() => setShowMore((v) => !v)}
              className="min-h-11"
            >
              {showMore ? t("packages.hideFilters") : t("packages.moreFilters")}
              {extra > 0 && <Badge tone="accent">{extra}</Badge>}
            </Button>
          </div>
          {showMore && (
            <MoreFilters
              filters={filters}
              myId={me.data && !me.data.isGuest ? me.data.id : null}
              onChange={change}
              onClear={() => change({ ...NO_FILTERS, language: filters.language })}
            />
          )}

          {packages.isLoading ? (
            <Spinner label={t("common.loading")} />
          ) : packages.isError ? (
            <p role="alert" className="text-danger">
              {t("packages.loadFailed")}
            </p>
          ) : packages.data && packages.data.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong p-8 text-center text-muted">
              {t("packages.empty")}
            </div>
          ) : (
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-3.5 p-0">
              {packages.data?.items.map((p) => (
                <li key={p.id}>
                  <PackageTile
                    pkg={p}
                    selected={p.id === selectedId}
                    onSelect={() => select(p.id)}
                  />
                </li>
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
        </section>

        <Dialog
          open={selectedId != null}
          onOpenChange={(open) => !open && select(undefined)}
          title={t("packages.details")}
          closeLabel={t("common.close")}
        >
          <div className="flex flex-col gap-5 p-5 sm:p-6" data-testid="package-details">
            {selectedId != null && <PackageDetail id={selectedId} />}
          </div>
        </Dialog>
      </div>
    </PageContainer>
  );
}

function PackageTile({
  pkg,
  selected,
  onSelect,
}: {
  pkg: PackageCard;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex h-full w-full flex-col gap-2.5 rounded-[18px] border-2 bg-surface p-[18px] text-left text-text",
        selected ? "border-accent" : "border-line hover:border-line-strong",
      )}
      data-testid="package-tile"
    >
      <span className="text-lg font-semibold [overflow-wrap:anywhere]">{pkg.title}</span>
      <span className="text-sm text-muted">
        {t("packages.by", { name: pkg.author.username })}
        {pkg.language ? ` · ${pkg.language.toUpperCase()}` : ""}
      </span>
      {pkg.roundsCount != null && (
        <span className="text-sm text-soft">
          {t("packages.counts", { rounds: pkg.roundsCount, questions: pkg.questionsCount ?? 0 })}
        </span>
      )}
      {pkg.ageRestriction && pkg.ageRestriction !== "NONE" && (
        <Badge tone="warning" className="self-start">
          {pkg.ageRestriction.replace("A", "")}+
        </Badge>
      )}
    </button>
  );
}

function PackageDetail({ id }: { id: number }) {
  const { t } = useTranslation();
  const pkg = usePackage(id);
  const me = useMe();
  if (pkg.isLoading) return <Spinner label={t("common.loading")} />;
  if (pkg.isError || !pkg.data)
    return (
      <p role="alert" className="m-0 text-danger">
        {t("packages.loadFailed")}
      </p>
    );
  return (
    <PackageSummaryView
      pkg={pkg.data}
      canHost={me.data != null}
      isAuthor={me.data != null && me.data.id === pkg.data.author.id}
    />
  );
}

function PackageSummaryView({
  pkg,
  canHost,
  isAuthor,
}: {
  pkg: OqPackage;
  canHost: boolean;
  isAuthor: boolean;
}) {
  const { t } = useTranslation();
  const s = summarize(pkg);
  const media = [
    s.hasImages && t("packages.media.images"),
    s.hasAudio && t("packages.media.audio"),
    s.hasVideo && t("packages.media.video"),
  ].filter(Boolean);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="m-0 font-display text-[clamp(24px,3vw,30px)] font-extrabold [overflow-wrap:anywhere]">
          {pkg.title}
        </h2>
        <span className="text-sm text-muted">
          {t("packages.by", { name: pkg.author.username })}
          {pkg.language ? ` · ${pkg.language.toUpperCase()}` : ""}
        </span>
      </div>
      {pkg.description && <p className="m-0 text-soft">{pkg.description}</p>}
      <div className="flex flex-col gap-2">
        <span className="font-semibold">{t("packages.rounds")}</span>
        {s.rounds.map((r, i) => (
          <div
            key={i}
            className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-[12px] bg-surface-2 px-4 py-3"
          >
            <span className="font-medium [overflow-wrap:anywhere]">
              {i + 1} · {r.name}
            </span>
            <span className="text-muted">
              {r.type === "final"
                ? t("packages.finalThemes", { count: r.themes })
                : t("packages.roundCounts", { themes: r.themes, questions: r.questions })}
            </span>
          </div>
        ))}
      </div>
      {(media.length > 0 || s.specialTypes.length > 0) && (
        <p className="m-0 text-sm text-muted">
          {media.length > 0 && t("packages.has", { list: media.join(", ") })}
          {media.length > 0 && s.specialTypes.length > 0 && " · "}
          {s.specialTypes.length > 0 &&
            t("packages.special", {
              list: s.specialTypes.map((x) => t(`questionTypes.${x}`)).join(", "),
            })}
        </p>
      )}
      {canHost ? (
        <Link
          to="/games/new"
          search={{ packageId: pkg.id }}
          className="flex min-h-14 items-center justify-center rounded-md bg-accent text-lg font-semibold text-on-accent no-underline hover:text-on-accent"
        >
          {t("packages.host")}
        </Link>
      ) : (
        <Link
          to="/login"
          search={{ redirect: `/games/new?packageId=${pkg.id}` }}
          className="flex min-h-14 items-center justify-center rounded-md bg-accent text-lg font-semibold text-on-accent no-underline hover:text-on-accent"
        >
          {t("packages.signInToHost")}
        </Link>
      )}
      <Link
        to="/packages/$packageId/preview"
        params={{ packageId: String(pkg.id) }}
        className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-line-strong font-semibold text-text no-underline hover:bg-surface-2 hover:text-text"
        data-testid="package-preview"
      >
        <EyeIcon size={18} />
        {t("packages.preview")}
      </Link>
      {isAuthor && <AuthorTools id={pkg.id} />}
    </>
  );
}

/** Edit and delete for the package's own author. */
function AuthorTools({ id }: { id: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { opening, error, open } = useOpenInEditor();
  const del = useDeletePackage();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-col gap-2" data-testid="author-tools">
      <div className="flex flex-wrap gap-2">
        <Button icon={<EditIcon size={18} />} disabled={opening} onClick={() => void open(id)}>
          {opening ? t("myPackages.opening") : t("myPackages.edit")}
        </Button>
        {confirm ? (
          <>
            <Button
              variant="danger"
              disabled={del.isPending}
              onClick={() =>
                del.mutate(id, {
                  onSuccess: () => void navigate({ to: "/packages/mine" }),
                })
              }
            >
              {t("myPackages.confirmDelete")}
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {t("common.cancel")}
            </Button>
          </>
        ) : (
          <Button variant="ghost" icon={<TrashIcon size={18} />} onClick={() => setConfirm(true)}>
            {t("myPackages.delete")}
          </Button>
        )}
      </div>
      {confirm && <p className="m-0 text-sm text-muted">{t("myPackages.deleteHelp")}</p>}
      {(error || del.isError) && (
        <p role="alert" className="m-0 text-sm text-danger">
          {error ?? t("myPackages.deleteFailed")}
        </p>
      )}
    </div>
  );
}

const AGES = ["NONE", "A12", "A16", "A18"] as const;

function MoreFilters({
  filters,
  myId,
  onChange,
  onClear,
}: {
  filters: PackageFilters;
  myId: number | null;
  onChange: (patch: Partial<PackageFilters>) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      id="pk-more"
      className="flex flex-wrap items-end gap-x-5 gap-y-4 rounded-lg border border-line bg-surface p-4"
      data-testid="package-filters"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pk-age" className="text-sm text-muted">
          {t("packages.age")}
        </label>
        <Select
          id="pk-age"
          className="w-auto"
          value={filters.age}
          onChange={(e) => onChange({ age: e.target.value as PackageFilters["age"] })}
        >
          <option value="">{t("packages.anyAge")}</option>
          {AGES.map((a) => (
            <option key={a} value={a}>
              {a === "NONE" ? t("packages.ageNone") : `${a.slice(1)}+`}
            </option>
          ))}
        </Select>
      </div>
      <RangeFilter
        id="pk-rounds"
        label={t("packages.roundsRange")}
        min={filters.minRounds}
        max={filters.maxRounds}
        onChange={(minRounds, maxRounds) => onChange({ minRounds, maxRounds })}
      />
      <RangeFilter
        id="pk-questions"
        label={t("packages.questionsRange")}
        min={filters.minQuestions}
        max={filters.maxQuestions}
        onChange={(minQuestions, maxQuestions) => onChange({ minQuestions, maxQuestions })}
      />
      {myId != null && (
        <label className="flex min-h-11 items-center gap-2.5">
          <input
            type="checkbox"
            checked={filters.authorId === myId}
            onChange={(e) => onChange({ authorId: e.target.checked ? myId : null })}
            className="h-5 w-5 accent-[var(--oq-accent)]"
          />
          {t("packages.onlyMine")}
        </label>
      )}
      <Button size="sm" variant="ghost" className="min-h-11" onClick={onClear}>
        {t("packages.clearFilters")}
      </Button>
    </div>
  );
}

function RangeFilter({
  id,
  label,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}) {
  const { t } = useTranslation();
  const parse = (v: string) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm text-muted">{label}</legend>
      <div className="flex items-center gap-2">
        <label htmlFor={`${id}-min`} className="sr-only">
          {t("packages.min")}
        </label>
        <TextInput
          id={`${id}-min`}
          inputMode="numeric"
          placeholder={t("packages.min")}
          value={min ?? ""}
          onChange={(e) => onChange(parse(e.target.value), max)}
          className="w-20"
        />
        <span className="text-muted">–</span>
        <label htmlFor={`${id}-max`} className="sr-only">
          {t("packages.max")}
        </label>
        <TextInput
          id={`${id}-max`}
          inputMode="numeric"
          placeholder={t("packages.max")}
          value={max ?? ""}
          onChange={(e) => onChange(min, parse(e.target.value))}
          className="w-20"
        />
      </div>
    </fieldset>
  );
}
