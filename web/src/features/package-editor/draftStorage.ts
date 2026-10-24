import type { ImportWarning } from "@/features/upload/types";
import type { MediaFile } from "@/features/upload/types";

import { countQuestions, reachableMedia, type DraftPackage } from "./packageDraft";

/**
 * Drafts live in this browser's IndexedDB until they're published: the
 * package tree in `drafts`, media bytes in `media` keyed by MD5 so drafts that
 * share a file store it once. Without IndexedDB (private mode, tests) drafts
 * last for the tab.
 */
export interface PackageDraftRecord {
  id: string;
  pkg: DraftPackage;
  updatedAt: number;
  /** Set once uploaded, so the list can link to the published package. */
  publishedId?: number;
  /** What the import of the original file changed or left out. */
  importWarnings?: ImportWarning[];
}

export interface PackageDraftSummary {
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
const memory = {
  drafts: new Map<string, PackageDraftRecord>(),
  media: new Map<string, MediaFile>(),
};

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

export async function listDrafts(): Promise<PackageDraftSummary[]> {
  const db = await open();
  const all = db
    ? ((await run<PackageDraftRecord[]>(
        "drafts",
        "readonly",
        (s) => s.getAll() as IDBRequest<PackageDraftRecord[]>,
      )) ?? [])
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

export async function loadDraft(id: string): Promise<PackageDraftRecord | null> {
  const db = await open();
  if (!db) return memory.drafts.get(id) ?? null;
  return (
    (await run<PackageDraftRecord>(
      "drafts",
      "readonly",
      (s) => s.get(id) as IDBRequest<PackageDraftRecord>,
    )) ?? null
  );
}

/** Commit references and their available media together, including across tabs. */
export async function saveDraft(
  draft: PackageDraftRecord,
  files: Iterable<MediaFile> = [],
): Promise<void> {
  const referenced = reachableMedia(draft.pkg);
  const media = [...files].filter((file) => referenced.has(file.md5));
  const db = await open();
  if (!db) {
    for (const file of media) memory.media.set(file.md5, file);
    memory.drafts.set(draft.id, draft);
    const keep = new Set([...memory.drafts.values()].flatMap((d) => [...reachableMedia(d.pkg)]));
    for (const md5 of memory.media.keys()) if (!keep.has(md5)) memory.media.delete(md5);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["drafts", "media"], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    try {
      tx.objectStore("drafts").put(draft);
      for (const file of media) tx.objectStore("media").put(file);
      collectInTransaction(tx);
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
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

/** Read references and remove unused media in one transaction with the same save scope. */
export async function collectMedia(): Promise<void> {
  const db = await open();
  const keep = new Set<string>();
  if (!db) {
    for (const draft of memory.drafts.values())
      for (const md5 of reachableMedia(draft.pkg)) keep.add(md5);
    for (const md5 of memory.media.keys()) if (!keep.has(md5)) memory.media.delete(md5);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["drafts", "media"], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    collectInTransaction(tx);
  });
}

/** Collect against the committed references in the same lock scope, including the draft being saved. */
function collectInTransaction(tx: IDBTransaction) {
  const keep = new Set<string>();
  const drafts = tx.objectStore("drafts").getAll() as IDBRequest<PackageDraftRecord[]>;
  drafts.onsuccess = () => {
    for (const draft of drafts.result) for (const md5 of reachableMedia(draft.pkg)) keep.add(md5);
    const media = tx.objectStore("media");
    const cursor = media.openKeyCursor();
    cursor.onsuccess = () => {
      const item = cursor.result;
      if (!item) return;
      if (!keep.has(String(item.key))) media.delete(item.key);
      item.continue();
    };
  };
}
