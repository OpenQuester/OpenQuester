import type { MediaFile, MediaType } from "./types";

/**
 * Files of an upload that hasn't finished, kept in this browser's IndexedDB
 * per package so its author can resume it later without picking the package
 * file again (and without encoding the media again, which wouldn't give the
 * same bytes for video). Best effort: without IndexedDB or room for the
 * bytes, resuming asks for the package file instead.
 */
interface StashedFile {
  packageId: number;
  md5: string;
  name: string;
  type: MediaType;
  bytes: Blob;
}

const DB = "oq-uploads";
const STORE = "files";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: ["packageId", "md5"] });
        store.createIndex("package", "packageId");
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

function tx<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        if (!db) return resolve(undefined);
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(req ? req.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

/** Keeps these files for the package until they're uploaded. Never throws. */
export async function stashFiles(packageId: number, files: MediaFile[]): Promise<boolean> {
  if (files.length === 0) return true;
  try {
    const bytes = files.reduce((n, f) => n + f.bytes.byteLength, 0);
    const estimate = await navigator.storage?.estimate?.();
    if (
      estimate?.quota != null &&
      estimate.usage != null &&
      estimate.quota - estimate.usage < bytes * 1.2
    )
      return false;
    await tx("readwrite", (s) => {
      for (const f of files)
        s.put({
          packageId,
          md5: f.md5,
          name: f.name,
          type: f.type,
          bytes: new Blob([f.bytes as BlobPart]),
        } satisfies StashedFile);
    });
    return true;
  } catch {
    return false;
  }
}

export async function unstashFile(packageId: number, md5: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete([packageId, md5]));
  } catch {
    // Best effort.
  }
}

export async function clearStash(packageId: number): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(IDBKeyRange.bound([packageId, ""], [packageId, "￿"])));
  } catch {
    // Best effort.
  }
}

/** Stashed files of the package among these MD5s. */
export async function loadStash(
  packageId: number,
  md5s: Iterable<string>,
): Promise<Map<string, MediaFile>> {
  const out = new Map<string, MediaFile>();
  try {
    const rows =
      (await tx<StashedFile[]>("readonly", (s) => s.index("package").getAll(packageId))) ?? [];
    const wanted = new Set(md5s);
    for (const r of rows) {
      if (!wanted.has(r.md5)) continue;
      out.set(r.md5, {
        md5: r.md5,
        name: r.name,
        type: r.type,
        bytes: new Uint8Array(await r.bytes.arrayBuffer()),
      });
    }
  } catch {
    // Nothing stashed we can read.
  }
  return out;
}
