import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StoreApi } from "zustand";

import { Spinner } from "@/ui/Spinner";

import { loadDraft, loadMedia, putMedia, saveDraft } from "./drafts";
import { EditorShell } from "./EditorShell";
import { reachableMedia } from "./model";
import { createEditorStore, EditorContext, type EditorState } from "./store";

const SAVE_DELAY = 600;

export function EditorPage() {
  const { t } = useTranslation();
  const { draftId } = useParams({ from: "/packages/editor/$draftId" });
  const [loaded, setLoaded] = useState<{
    id: string;
    store: StoreApi<EditorState> | "missing";
  } | null>(null);
  const store = loaded?.id === draftId ? loaded.store : null;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const draft = await loadDraft(draftId);
      if (!alive) return;
      if (!draft) return setLoaded({ id: draftId, store: "missing" });
      const media = await loadMedia(reachableMedia(draft.pkg));
      if (!alive) return;
      setLoaded({
        id: draftId,
        store: createEditorStore({
          draftId,
          pkg: draft.pkg,
          media,
          savedAt: draft.updatedAt,
          publishedId: draft.publishedId,
          importWarnings: draft.importWarnings,
        }),
      });
    })();
    return () => {
      alive = false;
    };
  }, [draftId]);

  useAutosave(store && store !== "missing" ? store : null);

  if (store === "missing")
    return (
      <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-16">
        <h1 className="m-0 font-display text-3xl font-extrabold">{t("editor.missing")}</h1>
        <p className="m-0 text-muted">{t("editor.missingHelp")}</p>
        <Link to="/packages/editor">{t("editor.backToDrafts")}</Link>
      </div>
    );
  if (!store)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner label={t("common.loading")} />
      </div>
    );
  return (
    <EditorContext.Provider value={store}>
      <EditorShell />
    </EditorContext.Provider>
  );
}

/**
 * Writes the draft to IndexedDB shortly after each change, plus any new
 * media, and once more when the tab is hidden so closing it loses nothing.
 */
function useAutosave(store: StoreApi<EditorState> | null) {
  useEffect(() => {
    if (!store) return;
    let timer: number | null = null;
    const savedMedia = new Set(store.getState().media.keys());
    const flush = async () => {
      timer = null;
      const s = store.getState();
      try {
        const fresh = [...s.media.values()].filter((f) => !savedMedia.has(f.md5));
        await putMedia(fresh);
        for (const f of fresh) savedMedia.add(f.md5);
        const at = Date.now();
        await saveDraft({
          id: s.draftId,
          pkg: s.pkg,
          updatedAt: at,
          publishedId: s.publishedId,
          importWarnings: s.importWarnings,
        });
        s.markSaved(at);
      } catch (error) {
        // IndexedDB full or the write aborted: the edits only live in this tab
        s.markSaveFailed(error instanceof Error ? error.message : String(error));
      }
    };
    const unsub = store.subscribe((s, prev) => {
      if (s.saveRequest !== prev.saveRequest) {
        void flush();
        return;
      }
      if (
        s.pkg === prev.pkg &&
        s.media === prev.media &&
        s.publishedId === prev.publishedId &&
        s.importWarnings === prev.importWarnings
      )
        return;
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void flush(), SAVE_DELAY);
    });
    const onHide = () => {
      if (timer != null) {
        window.clearTimeout(timer);
        void flush();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      unsub();
      onHide();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [store]);
}
