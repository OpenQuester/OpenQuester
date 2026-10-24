import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { readPackageFile } from "@/features/upload/upload";
import { deleteDraft, listDrafts, type PackageDraftSummary } from "../draftStorage";
import { draftFromParsed, newDraft } from "../createDraft";

export function useDraftLibrary() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<PackageDraftSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    void listDrafts().then(
      (list) => {
        if (alive) setDrafts(list);
      },
      () => {
        if (alive) setError(t("common.loadFailed"));
      },
    );
    return () => {
      alive = false;
    };
  }, [attempt, t]);

  const reload = () => {
    setError(null);
    setAttempt((value) => value + 1);
  };

  const open = (draftId: string) =>
    void navigate({ to: "/packages/editor/$draftId", params: { draftId } });

  const create = async () => {
    setError(null);
    setBusy("new");
    try {
      open(
        await newDraft(
          t("editor.defaults.title"),
          t("editor.defaults.round", { n: 1 }),
          t("editor.defaults.theme"),
        ),
      );
    } catch {
      setError(t("editor.storageFailed"));
    } finally {
      setBusy(null);
    }
  };

  const importFile = async (file: File) => {
    setError(null);
    setBusy(file.name);
    try {
      open(await draftFromParsed(await readPackageFile(file)));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(t(`upload.readErrors.${code}`, { defaultValue: t("upload.readErrors.generic") }));
      setBusy(null);
    }
  };

  const remove = async (draft: PackageDraftSummary) => {
    if (!window.confirm(t("editor.home.deleteConfirm", { title: draft.title }))) return;
    try {
      await deleteDraft(draft.id);
      reload();
    } catch {
      setError(t("editor.storageFailed"));
    }
  };
  return { drafts, busy, error, create, importFile, remove, reload };
}
