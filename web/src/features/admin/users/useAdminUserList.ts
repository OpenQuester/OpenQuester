import { useEffect, useState } from "react";
import type { SetStateAction } from "react";
import type { User } from "@/api/types";
import { ADMIN_PAGE_SIZE, can, useAdminUsers, useUserAction, type UserQuery } from "../useAdmin";

export function useAdminUserList(me: User) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState<UserQuery>({ search: "", status: "", userType: "all", page: 0 });
  const users = useAdminUsers(q, can(me, "view_users_info"));
  const action = useUserAction();
  useEffect(() => {
    const id = window.setTimeout(
      () => setQ((x) => (x.search === search ? x : { ...x, search, page: 0 })),
      250,
    );
    return () => window.clearTimeout(id);
  }, [search]);
  const pages = Math.max(1, Math.ceil((users.data?.pageInfo.total ?? 0) / ADMIN_PAGE_SIZE));
  const s = users.data?.stats;
  function setPage(update: SetStateAction<number>) {
    setQ((current) => ({
      ...current,
      page: typeof update === "function" ? update(current.page) : update,
    }));
  }
  return { search, setSearch, q, setQ, users, action, pages, s, setPage };
}
