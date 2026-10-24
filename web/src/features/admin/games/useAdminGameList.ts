import { useEffect, useState } from "react";
import { ADMIN_PAGE_SIZE, useAdminGames } from "../useAdmin";

export function useAdminGameList() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const games = useAdminGames(search, page, true);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(input);
      setPage(0);
    }, 250);
    return () => window.clearTimeout(id);
  }, [input]);
  const pages = Math.max(1, Math.ceil((games.data?.pageInfo.total ?? 0) / ADMIN_PAGE_SIZE));
  return { input, setInput, page, setPage, open, setOpen, games, pages };
}
