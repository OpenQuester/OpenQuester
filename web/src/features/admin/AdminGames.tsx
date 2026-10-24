import { useTranslation } from "react-i18next";
import { TextInput } from "@/ui/Field";
import { Spinner } from "@/ui/Spinner";
import { Pagination } from "@/ui/Pagination";
import { AdminGameRow } from "./games/AdminGameRow";
import { useAdminGameList } from "./games/useAdminGameList";
import { adminStyles } from "./adminStyles";

export function AdminGames() {
  const { t } = useTranslation();
  const { input, setInput, page, setPage, open, setOpen, games, pages } = useAdminGameList();
  return (
    <div className={adminStyles.listPage} data-testid="admin-games">
      <label htmlFor="adm-game-search" className="sr-only">
        {t("adminPanel.gameSearch")}
      </label>
      <TextInput
        id="adm-game-search"
        type="search"
        value={input}
        placeholder={t("adminPanel.gameSearch")}
        onChange={(e) => setInput(e.target.value)}
        className="bg-surface"
      />
      {games.isLoading ? (
        <Spinner label={t("common.loading")} />
      ) : games.isError ? (
        <p role="alert" className="text-danger">
          {t("adminPanel.loadFailed")}
        </p>
      ) : games.data?.data.length === 0 ? (
        <p className="m-0 text-muted">{t("adminPanel.noGames")}</p>
      ) : (
        <ul className={adminStyles.list}>
          {games.data?.data.map((g) => (
            <AdminGameRow
              key={g.id}
              game={g}
              open={open === g.id}
              onToggle={() => setOpen((x) => (x === g.id ? null : g.id))}
            />
          ))}
        </ul>
      )}
      <Pagination page={page} pages={pages} setPage={setPage} />
    </div>
  );
}
