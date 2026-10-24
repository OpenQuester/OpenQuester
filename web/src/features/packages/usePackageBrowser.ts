import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMe } from "@/features/auth/useMe";
import {
  extraFilterCount,
  NO_FILTERS,
  PAGE_SIZE,
  usePackages,
  type PackageFilters,
} from "./usePackages";

/** Owns catalogue filters, debounced search, pagination and URL selection. */
export function usePackageBrowser() {
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
  return {
    me,
    query,
    setQuery,
    filters,
    change,
    showMore,
    setShowMore,
    extra,
    page,
    setPage,
    packages,
    selectedId,
    select,
    pages,
  };
}

export type PackageBrowser = ReturnType<typeof usePackageBrowser>;
