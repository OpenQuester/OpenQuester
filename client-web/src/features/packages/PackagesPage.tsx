import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Filter, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { api, pageTotal, unwrapPage } from "../../shared/api/client";
import styles from "../../shared/ui/ui.module.css";
import { PackageCard } from "../games/HomePage";

export function PackagesPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(false);
  const [sort, setSort] = useState("created_at");
  const [language, setLanguage] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 18;
  const query = useQuery({
    queryKey: ["packages", search, mine, sort, language, page],
    queryFn: () =>
      api.packages(
        `limit=${pageSize}&offset=${page * pageSize}&sortBy=${sort}&order=DESC${search ? `&title=${encodeURIComponent(search)}` : ""}${language ? `&language=${encodeURIComponent(language)}` : ""}${mine ? "&status=draft&mine=true" : ""}`,
      ),
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
          <select
            aria-label={t("packages.language")}
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value);
              resetPage();
            }}
          >
            <option value="">{t("packages.allLanguages")}</option>
            <option value="en">{t("language.en")}</option>
            <option value="uk">{t("language.uk")}</option>
            <option value="ru">{t("language.ru")}</option>
          </select>
        </label>
        <label className={styles.search}>
          <Filter size={15} />
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              resetPage();
            }}
          >
            <option value="created_at">{t("packages.newest")}</option>
            <option value="updated_at">{t("packages.updated")}</option>
          </select>
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
