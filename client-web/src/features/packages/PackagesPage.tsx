import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Filter, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import {
  api,
  type PackageQuery,
  pageTotal,
  unwrapPage,
} from "../../shared/api/client";
import { SelectField } from "../../shared/ui/SelectField";
import styles from "../../shared/ui/ui.module.css";
import { PackageCard } from "../games/HomePage";

type PackagesSortBy = NonNullable<PackageQuery["sortBy"]>;

/** Returns `value` only after it has stopped changing for `delay` ms. */
function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return settled;
}

export function PackagesPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(false);
  const [sort, setSort] = useState<PackagesSortBy>("created_at");
  const [language, setLanguage] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 18;
  // Typing is not a reason to hit the API; wait for a pause in it.
  const debouncedSearch = useDebounced(search, 300);
  const query = useQuery({
    queryKey: ["packages", debouncedSearch, mine, sort, language, page],
    queryFn: () =>
      api.packages({
        limit: pageSize,
        offset: page * pageSize,
        sortBy: sort,
        order: "desc",
        title: debouncedSearch.trim() || undefined,
        language: language || undefined,
        // "Mine" means every package I own, draft and published alike.
        mine: mine || undefined,
      }),
    // Hold the previous page on screen instead of flashing an empty grid.
    placeholderData: keepPreviousData,
    retry: false,
  });
  const server = unwrapPage(query.data);
  const total = pageTotal(query.data);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const resetPage = () => setPage(0);
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>{t("packages.eyebrow")}</p>
          <h1>{t("packages.title")}</h1>
          <p className={styles.lede}>{t("packages.subtitle")}</p>
        </div>
        <Link className={styles.primaryButton} to="/editor/new">
          <Plus size={16} />
          {t("editor.new")}
        </Link>
      </header>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            placeholder={t("packages.search")}
            aria-label={t("packages.search")}
          />
        </label>
        <div className={styles.segmented}>
          <button
            data-active={!mine}
            onClick={() => {
              setMine(false);
              resetPage();
            }}
          >
            {t("packages.all")}
          </button>
          <button
            data-active={mine}
            onClick={() => {
              setMine(true);
              resetPage();
            }}
          >
            {t("packages.mine")}
          </button>
        </div>
        <label className={styles.search}>
          <Filter size={15} />
          <SelectField
            ariaLabel={t("packages.language")}
            value={language}
            onValueChange={(value) => {
              setLanguage(value);
              resetPage();
            }}
            options={[
              { value: "", label: t("packages.allLanguages") },
              { value: "en", label: t("language.en") },
              { value: "uk", label: t("language.uk") },
              { value: "ru", label: t("language.ru") },
            ]}
          />
        </label>
        <label className={styles.search}>
          <Filter size={15} />
          <SelectField
            value={sort}
            ariaLabel={t("packages.newest")}
            onValueChange={(value) => {
              setSort(value as PackagesSortBy);
              resetPage();
            }}
            options={[
              { value: "created_at", label: t("packages.newest") },
              { value: "updated_at", label: t("packages.updated") },
            ]}
          />
        </label>
      </div>
      {query.isPending ? (
        <div className={styles.empty}>{t("common.loading")}</div>
      ) : query.isError ? (
        <div className={styles.empty} role="alert">
          {t("common.loadFailed")}
          <button
            className={styles.textLink}
            onClick={() => void query.refetch()}
          >
            {t("common.retry")}
          </button>
        </div>
      ) : server.length ? (
        <div className={styles.grid}>
          {server.map((item) => (
            <PackageCard item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>{t("packages.empty")}</div>
      )}
      {!query.isPending && !query.isError && total > pageSize ? (
        <nav
          className={styles.pagination}
          aria-label={t("packages.pagination")}
        >
          <button
            className={styles.secondaryButton}
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            <ChevronLeft size={15} /> {t("common.previous")}
          </button>
          <span>
            {t("packages.page", { current: page + 1, total: pageCount })}
          </span>
          <button
            className={styles.secondaryButton}
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            {t("common.next")} <ChevronRight size={15} />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
