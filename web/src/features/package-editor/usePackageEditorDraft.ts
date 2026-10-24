import { useEffect, useState } from "react";
import type { StoreApi } from "zustand";
import { loadDraft, loadMedia, saveDraft } from "./draftStorage";
import { releaseMediaUrl } from "./packageMedia";
import { reachableMedia } from "./packageDraft";
import { createPackageEditorStore, type PackageEditorState } from "./packageEditorStore";

const SAVE_DELAY = 600;

/** Owns a draft store and its media URLs for the current route. */
export function usePackageEditorDraft(draftId: string) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{
    id: string;
    store: StoreApi<PackageEditorState> | "missing" | "failed";
  } | null>(null);
  const store = loaded?.id === draftId ? loaded.store : null;

  useEffect(() => {
    let alive = true;
    let ownedStore: StoreApi<PackageEditorState> | undefined;
    void (async () => {
      const draft = await loadDraft(draftId);
      if (!alive) return;
      if (!draft) return setLoaded({ id: draftId, store: "missing" });
      const media = await loadMedia(reachableMedia(draft.pkg));
      if (!alive) return;
      ownedStore = createPackageEditorStore({
        draftId,
        pkg: draft.pkg,
        media,
        savedAt: draft.updatedAt,
        publishedId: draft.publishedId,
        importWarnings: draft.importWarnings,
      });
      setLoaded({ id: draftId, store: ownedStore });
    })().catch(() => {
      if (alive) setLoaded({ id: draftId, store: "failed" });
    });
    return () => {
      alive = false;
      for (const file of ownedStore?.getState().media.values() ?? []) releaseMediaUrl(file);
    };
  }, [draftId, attempt]);

  useAutosave(store && typeof store !== "string" ? store : null);

  return {
    store,
    retry: () => {
      setLoaded(null);
      setAttempt((value) => value + 1);
    },
  };
}

/**
 * Writes the draft to IndexedDB shortly after each change, plus any new
 * media, and once more when the tab is hidden so closing it loses nothing.
 */
function useAutosave(store: StoreApi<PackageEditorState> | null) {
  useEffect(() => {
    if (!store) return;
    let timer: number | null = null;
    const flush = async () => {
      timer = null;
      const s = store.getState();
      try {
        const at = Date.now();
        await saveDraft(
          {
            id: s.draftId,
            pkg: s.pkg,
            updatedAt: at,
            publishedId: s.publishedId,
            importWarnings: s.importWarnings,
          },
          s.media.values(),
        );
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
