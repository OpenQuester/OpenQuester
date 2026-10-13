import type { MediaFile } from "@/features/upload/types";

import { countQuestions, reachableMedia, type EditorPackage } from "./model";

/**
 * Drafts live in this browser's IndexedDB until they're published: the
 * package tree in `drafts`, media bytes in `media` keyed by MD5 so drafts that
 * share a file store it once. Without IndexedDB (private mode, tests) drafts
 * last for the tab.
 */
export interface Draft {
  id: string;
  pkg: EditorPackage;
  updatedAt: number;
  /** Set once uploaded, so the list can link to the published package. */
  publishedId?: number;
}

export interface DraftSummary {
  id: string;
  title: string;
  updatedAt: number;
  rounds: number;
  questions: number;
  publishedId?: number;
}

const DB = "oq-editor";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = { drafts: new Map<string, Draft>(), media: new Map<string, MediaFile>() };

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("drafts"))
          db.createObjectStore("drafts", { keyPath: "id" });
        if (!db.objectStoreNames.contains("media"))
          db.createObjectStore("media", { keyPath: "md5" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(
  store: "drafts" | "media",
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        if (!db) return resolve(undefined);
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export async function listDrafts(): Promise<DraftSummary[]> {
  const db = await open();
  const all = db
    ? ((await run<Draft[]>("drafts", "readonly", (s) => s.getAll() as IDBRequest<Draft[]>)) ?? [])
    : [...memory.drafts.values()];
  return all
    .map((d) => ({
      id: d.id,
      title: d.pkg.title,
      updatedAt: d.updatedAt,
      rounds: d.pkg.rounds.length,
      questions: countQuestions(d.pkg),
      publishedId: d.publishedId,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadDraft(id: string): Promise<Draft | null> {
  const db = await open();
  if (!db) return memory.drafts.get(id) ?? null;
  return (await run<Draft>("drafts", "readonly", (s) => s.get(id) as IDBRequest<Draft>)) ?? null;
}

export async function saveDraft(draft: Draft): Promise<void> {
  const db = await open();
  if (!db) {
    memory.drafts.set(draft.id, draft);
    return;
  }
  await run("drafts", "readwrite", (s) => s.put(draft));
}

export async function deleteDraft(id: string): Promise<void> {
  const db = await open();
  if (!db) memory.drafts.delete(id);
  else await run("drafts", "readwrite", (s) => s.delete(id));
  await collectMedia();
}

export async function loadMedia(md5s: Iterable<string>): Promise<Map<string, MediaFile>> {
  const out = new Map<string, MediaFile>();
  const db = await open();
  for (const md5 of md5s) {
    const file = db
      ? await run<MediaFile>("media", "readonly", (s) => s.get(md5) as IDBRequest<MediaFile>)
      : memory.media.get(md5);
    if (file) out.set(md5, file);
  }
  return out;
}

export async function putMedia(files: Iterable<MediaFile>): Promise<void> {
  const db = await open();
  for (const f of files) {
    if (!db) memory.media.set(f.md5, f);
    else await run("media", "readwrite", (s) => s.put(f));
  }
}

/** Drops stored media that no draft references any more. */
export async function collectMedia(): Promise<void> {
  const db = await open();
  const drafts = db
    ? ((await run<Draft[]>("drafts", "readonly", (s) => s.getAll() as IDBRequest<Draft[]>)) ?? [])
    : [...memory.drafts.values()];
  const keep = new Set<string>();
  for (const d of drafts) for (const md5 of reachableMedia(d.pkg)) keep.add(md5);
  if (!db) {
    for (const md5 of memory.media.keys()) if (!keep.has(md5)) memory.media.delete(md5);
    return;
  }
  const keys = (await run<IDBValidKey[]>("media", "readonly", (s) => s.getAllKeys())) ?? [];
  const stale = keys.filter((k) => !keep.has(String(k)));
  if (stale.length) await run("media", "readwrite", (s) => void stale.forEach((k) => s.delete(k)));
}
