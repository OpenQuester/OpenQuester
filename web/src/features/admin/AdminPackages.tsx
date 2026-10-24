import { useTranslation } from "react-i18next";
import type { User } from "@/api/types";
import { TextInput } from "@/ui/Field";
import { Spinner } from "@/ui/Spinner";
import { Pagination } from "@/ui/Pagination";
import { can } from "./useAdmin";
import { AdminPackageRow } from "./packages/AdminPackageRow";
import { useAdminPackageList } from "./packages/useAdminPackageList";
import { adminStyles } from "./adminStyles";

export function AdminPackages({ me }: { me: User }) {
  const { t } = useTranslation();
  const { input, setInput, page, setPage, packages, remove, editor, pages, failure } =
    useAdminPackageList();
  return (
    <div className={adminStyles.listPage} data-testid="admin-packages">
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
        <ul className={adminStyles.list}>
          {packages.data?.items.map((p) => (
            <AdminPackageRow
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
      <Pagination page={page} pages={pages} setPage={setPage} />
    </div>
  );
}
