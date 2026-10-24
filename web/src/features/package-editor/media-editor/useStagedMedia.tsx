import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { MediaFile } from "@/features/upload/types";
import { releaseMediaUrl } from "../packageMedia";
import { usePackageEditorStore } from "../packageEditorStore";
import { MediaEditor } from "./MediaEditor";
import type { MediaEditResult } from "./mediaEditorTypes";
import { acquireMedia } from "./processMedia";

type Request = {
  items: (File | MediaFile)[];
  title: string;
  index: number;
  id: number;
  apply: (result: MediaEditResult) => void;
  anchor: HTMLElement | null;
};
export type OpenMedia = (
  files: (File | MediaFile)[],
  title: string,
  apply: Request["apply"],
) => void;
export const MediaSessionContext = createContext<OpenMedia | null>(null);
export function useOpenMedia() {
  const open = useContext(MediaSessionContext);
  if (!open) throw new Error("Missing staged media session");
  return open;
}

/** Owns unsaved form media. Import and Cancel never write to the package store. */
export function useStagedMedia() {
  const store = usePackageEditorStore();
  const [pending, setPending] = useState(new Map<string, MediaFile>());
  const pendingRef = useRef(pending);
  const owned = useRef(new Set<MediaFile>());
  const [request, setRequest] = useState<Request | null>(null);
  const requestRef = useRef<Request | null>(null);
  const closeRef = useRef<(() => void) | null>(null);
  const batch = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const close = () => {
    batch.current?.abort();
    batch.current = null;
    const anchor = requestRef.current?.anchor;
    requestRef.current = null;
    setRequest(null);
    requestAnimationFrame(() => {
      if (anchor?.isConnected) anchor.focus();
    });
  };
  const open: OpenMedia = (items, title, apply) => {
    if (!items.length || requestRef.current) return;
    const r = {
      items,
      title,
      apply,
      index: 0,
      id: ++sequence.current,
      anchor: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    };
    requestRef.current = r;
    setRequest(r);
  };
  const accept = (r: Request, result: MediaEditResult) => {
    if (requestRef.current?.id !== r.id) return;
    owned.current.add(result.source);
    owned.current.add(result.file);
    const next = new Map(pendingRef.current);
    next.set(result.source.md5, result.source);
    next.set(result.file.md5, result.file);
    pendingRef.current = next;
    setPending(next);
    r.apply(result);
  };
  const advance = (r: Request) => {
    if (requestRef.current?.id !== r.id) return;
    if (r.index + 1 >= r.items.length) close();
    else {
      const next = { ...r, index: r.index + 1 };
      requestRef.current = next;
      setRequest(next);
    }
  };
  useEffect(
    () => () => {
      batch.current?.abort();
      requestRef.current = null;
      const kept = new Set(store.getState().media.values());
      for (const f of owned.current) if (!kept.has(f)) releaseMediaUrl(f);
    },
    [store],
  );
  const node = request && (
    <MediaEditor
      key={`${request.id}-${request.index}`}
      source={request.items[request.index]!}
      title={request.title}
      index={request.index}
      total={request.items.length}
      closeRef={closeRef}
      onClose={close}
      onSkip={() => advance(request)}
      onSave={(result) => {
        accept(request, result);
        advance(request);
      }}
      onRemaining={async (signal) => {
        const controller = new AbortController();
        batch.current = controller;
        const cancel = () => controller.abort();
        signal.addEventListener("abort", cancel, { once: true });
        try {
          for (let i = request.index; i < request.items.length; i++) {
            try {
              const { file } = await acquireMedia(request.items[i]!, controller.signal);
              if (controller.signal.aborted) {
                releaseMediaUrl(file);
                if (requestRef.current?.id === request.id) {
                  const next = { ...request, index: i };
                  requestRef.current = next;
                  setRequest(next);
                }
                return;
              }
              accept(request, {
                source: file,
                file: { ...file, preserveEncoding: true },
                geometryChanged: false,
              });
            } catch (error) {
              if (controller.signal.aborted) {
                if (requestRef.current) {
                  const next = { ...request, index: i };
                  requestRef.current = next;
                  setRequest(next);
                }
                return;
              }
              const next = { ...request, index: i };
              requestRef.current = next;
              setRequest(next);
              throw error;
            }
          }
          close();
        } finally {
          batch.current = null;
          signal.removeEventListener("abort", cancel);
        }
      }}
    />
  );
  return { pending, open, node, active: !!request, closeRef };
}
