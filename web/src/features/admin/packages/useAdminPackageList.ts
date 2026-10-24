import { useEffect, useState } from "react";
import { useDeletePackage, useOpenInEditor } from "@/features/packages/packageActions";
import {
  NO_FILTERS,
  PAGE_SIZE,
  usePackages,
  type PackageFilters,
} from "@/features/packages/usePackages";

export function useAdminPackageList() {
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
  return { input, setInput, page, setPage, packages, remove, editor, pages, failure };
}
