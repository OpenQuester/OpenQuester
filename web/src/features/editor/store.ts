import { createContext, useContext } from "react";
import { createStore, useStore, type StoreApi } from "zustand";

import type { MediaFile } from "@/features/upload/types";
import { safeStorage } from "@/lib/storage";

import type { EditorPackage } from "./model";

/**
 * One store per open editor (no global singleton), so two editors or a test
 * never share a session. The package is immutable: every edit replaces it, and
 * the previous tree goes on the undo stack.
 */
export type Density = "compact" | "cards";

export interface Change {
  /** Key under editor.changes.* for the undo toast. */
  key: string;
  args?: Record<string, string | number>;
  at: number;
}

export interface EditorState {
  draftId: string;
  pkg: EditorPackage;
  media: Map<string, MediaFile>;
  past: EditorPackage[];
  future: EditorPackage[];
  roundId: string | null;
  selectedId: string | null;
  editingId: string | null;
  density: Density;
  lastChange: Change | null;
  savedAt: number | null;
  publishedId?: number;
  /** A published package opened to look at: no edits, no autosave. */
  readOnly: boolean;

  apply: (fn: (pkg: EditorPackage) => EditorPackage, change?: Omit<Change, "at">) => void;
  undo: () => void;
  redo: () => void;
  selectRound: (id: string | null) => void;
  select: (id: string | null) => void;
  edit: (id: string | null) => void;
  setDensity: (d: Density) => void;
  addMedia: (files: MediaFile[]) => void;
  markSaved: (at: number) => void;
  setPublished: (id: number) => void;
}

const HISTORY = 100;
const DENSITY_KEY = "oq.editor.density";

export function createEditorStore(init: {
  draftId: string;
  pkg: EditorPackage;
  media: Map<string, MediaFile>;
  savedAt: number | null;
  publishedId?: number;
  readOnly?: boolean;
}): StoreApi<EditorState> {
  return createStore<EditorState>((set, get) => ({
    ...init,
    readOnly: init.readOnly ?? false,
    past: [],
    future: [],
    roundId: init.pkg.rounds[0]?.id ?? null,
    selectedId: null,
    editingId: null,
    density: safeStorage.get(DENSITY_KEY) === "cards" ? "cards" : "compact",
    lastChange: null,

    apply: (fn, change) => {
      const { pkg, past, readOnly } = get();
      if (readOnly) return;
      const next = fn(pkg);
      if (next === pkg) return;
      set({
        pkg: next,
        past: [...past.slice(-(HISTORY - 1)), pkg],
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
    markSaved: (savedAt) => set({ savedAt }),
    setPublished: (publishedId) => set({ publishedId }),
  }));
}

export const EditorContext = createContext<StoreApi<EditorState> | null>(null);

export function useEditorStore(): StoreApi<EditorState> {
  const store = useContext(EditorContext);
  if (!store) throw new Error("useEditor outside EditorContext");
  return store;
}

export function useEditor<T>(selector: (s: EditorState) => T): T {
  return useStore(useEditorStore(), selector);
}
