import type { ImportWarning } from "@/features/upload/types";
import { createContext, useContext } from "react";
import { createStore, useStore, type StoreApi } from "zustand";

import type { MediaFile } from "@/features/upload/types";
import { safeStorage } from "@/lib/storage";

import { reachableMedia, type DraftPackage } from "./packageDraft";
import { releaseMediaUrl } from "./packageMedia";

/**
 * One store per open editor (no global singleton), so two editors or a test
 * never share a session. The package is immutable: every edit replaces it, and
 * the previous tree goes on the undo stack.
 */
export type QuestionCardDensity = "compact" | "cards";

export interface PackageChange {
  /** Key under editor.changes.* for the undo toast. */
  key: string;
  args?: Record<string, string | number>;
  at: number;
}

export interface PackageEditorState {
  draftId: string;
  pkg: DraftPackage;
  media: Map<string, MediaFile>;
  past: DraftPackage[];
  future: DraftPackage[];
  roundId: string | null;
  selectedId: string | null;
  editingId: string | null;
  density: QuestionCardDensity;
  lastChange: PackageChange | null;
  savedAt: number | null;
  publishedId?: number;
  /** A published package opened to look at: no edits, no autosave. */
  readOnly: boolean;
  /** The original import report, retained for the publish check. */
  importWarnings: ImportWarning[];
  /** Why the last autosave failed (storage full, aborted write); null when saved. */
  saveError: string | null;
  /** Bumped to ask for an immediate save (Retry after a failed one). */
  saveRequest: number;

  apply: (
    fn: (pkg: DraftPackage) => DraftPackage,
    change?: Omit<PackageChange, "at">,
    files?: Iterable<MediaFile>,
  ) => void;
  undo: () => void;
  redo: () => void;
  selectRound: (id: string | null) => void;
  select: (id: string | null) => void;
  edit: (id: string | null) => void;
  setDensity: (d: QuestionCardDensity) => void;
  addMedia: (files: MediaFile[]) => void;
  markSaved: (at: number) => void;
  markSaveFailed: (error: string) => void;
  retrySave: () => void;
  setPublished: (id: number) => void;
}

const HISTORY = 100;
const DENSITY_KEY = "oq.editor.density";

export function createPackageEditorStore(init: {
  draftId: string;
  pkg: DraftPackage;
  media: Map<string, MediaFile>;
  savedAt: number | null;
  publishedId?: number;
  readOnly?: boolean;
  importWarnings?: ImportWarning[];
}): StoreApi<PackageEditorState> {
  return createStore<PackageEditorState>((set, get) => ({
    ...init,
    readOnly: init.readOnly ?? false,
    importWarnings: init.importWarnings ?? [],
    saveError: null,
    saveRequest: 0,
    past: [],
    future: [],
    roundId: init.pkg.rounds[0]?.id ?? null,
    selectedId: null,
    editingId: null,
    density: safeStorage.get(DENSITY_KEY) === "cards" ? "cards" : "compact",
    lastChange: null,

    apply: (fn, change, files = []) => {
      const { pkg, past, readOnly, media } = get();
      if (readOnly) return;
      const next = fn(pkg);
      if (next === pkg) return;
      const available = new Map(media);
      for (const file of files) available.set(file.md5, file);
      const history = [...past.slice(-(HISTORY - 1)), pkg];
      set({
        pkg: next,
        past: history,
        media: retainMedia(available, [next, ...history]),
        future: [],
        lastChange: change ? { ...change, at: Date.now() } : get().lastChange,
      });
    },
    undo: () => {
      const { past, pkg, future } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      set({ pkg: prev, past: past.slice(0, -1), future: [pkg, ...future], lastChange: null });
    },
    redo: () => {
      const { past, pkg, future } = get();
      const next = future[0];
      if (!next) return;
      set({ pkg: next, past: [...past, pkg], future: future.slice(1), lastChange: null });
    },
    selectRound: (roundId) => set({ roundId }),
    select: (selectedId) => set({ selectedId }),
    edit: (editingId) => set(editingId ? { editingId, selectedId: editingId } : { editingId }),
    setDensity: (density) => {
      safeStorage.set(DENSITY_KEY, density);
      set({ density });
    },
    addMedia: (files) => {
      const media = new Map(get().media);
      for (const f of files) media.set(f.md5, f);
      set({ media });
    },
    markSaved: (savedAt) => set({ savedAt, saveError: null }),
    markSaveFailed: (saveError) => set({ saveError }),
    retrySave: () => set({ saveRequest: get().saveRequest + 1 }),
    setPublished: (publishedId) => set({ publishedId }),
  }));
}

export const PackageEditorContext = createContext<StoreApi<PackageEditorState> | null>(null);
export const StagedMediaContext = createContext<Map<string, MediaFile> | null>(null);

/** Form-local replacements take precedence until the owning form commits. */
export function useMediaFile(md5: string | undefined): MediaFile | undefined {
  const staged = useContext(StagedMediaContext);
  const stored = usePackageEditor((s) => (md5 ? s.media.get(md5) : undefined));
  return (md5 ? staged?.get(md5) : undefined) ?? stored;
}

function retainMedia(media: Map<string, MediaFile>, versions: DraftPackage[]) {
  const keep = new Set(versions.flatMap((p) => [...reachableMedia(p)]));
  const result = new Map<string, MediaFile>();
  for (const [id, file] of media) {
    if (keep.has(id)) result.set(id, file);
    else releaseMediaUrl(file);
  }
  return result;
}

export function usePackageEditorStore(): StoreApi<PackageEditorState> {
  const store = useContext(PackageEditorContext);
  if (!store) throw new Error("useEditor outside EditorContext");
  return store;
}

export function usePackageEditor<T>(selector: (s: PackageEditorState) => T): T {
  return useStore(usePackageEditorStore(), selector);
}
