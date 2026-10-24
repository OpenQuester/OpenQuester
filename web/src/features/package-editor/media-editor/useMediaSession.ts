import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { MediaFile } from "@/features/upload/types";
import { acquireMedia } from "./processMedia";
import { releaseMediaUrl } from "../packageMedia";
import type { MediaEditControl, MediaEditStatus, MediaEditorProps } from "./mediaEditorTypes";
/** One keyed queue item's acquisition, processing, cancellation and shortcuts. */
export function useMediaSession({
  source,
  onSave,
  onClose,
  onRemaining,
  closeRef,
}: MediaEditorProps) {
  const [loaded, setLoaded] = useState<{ file: MediaFile; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<MediaEditStatus>({ ready: false, dirty: false });
  const [progress, setProgress] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const controlRef = useRef<MediaEditControl | null>(null);
  const abort = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const accepted = useRef(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const keepButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirm) keepButtonRef.current?.focus();
  }, [confirm]);
  const statusChanged = useCallback(
    (next: MediaEditStatus) =>
      setStatus((old) =>
        old.ready === next.ready && old.dirty === next.dirty && old.error === next.error
          ? old
          : next,
      ),
    [],
  );

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    let acquired: MediaFile | undefined;
    acquireMedia(source, controller.signal)
      .then((result) => {
        acquired = result.file;
        setLoaded(result);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "downloadFailed");
      });
    return () => {
      alive.current = false;
      controller.abort();
      abort.current?.abort();
      if (acquired && !accepted.current) releaseMediaUrl(acquired);
    };
  }, [source, retry]);

  const requestClose = useCallback(() => {
    if (abort.current) {
      abort.current.abort();
      return;
    }
    if (status.dirty) setConfirm(true);
    else onClose();
  }, [onClose, status.dirty]);
  useEffect(() => {
    closeRef.current = requestClose;
    return () => {
      closeRef.current = null;
    };
  }, [closeRef, requestClose]);

  const save = async (unchanged = false) => {
    if (!loaded || abort.current || (!unchanged && !status.ready)) return;
    const controller = new AbortController();
    abort.current = controller;
    setProgress(0);
    setError(null);
    try {
      const result =
        unchanged || !status.dirty
          ? { file: { ...loaded.file, preserveEncoding: true }, geometryChanged: false }
          : await controlRef.current!.save(controller.signal, setProgress);
      if (alive.current && !controller.signal.aborted) {
        accepted.current = true;
        onSave({ ...result, source: loaded.file });
      }
    } catch (e) {
      if (alive.current && !controller.signal.aborted)
        setError(e instanceof Error ? e.message : "processingFailed");
    } finally {
      if (alive.current) setProgress(null);
      abort.current = null;
    }
  };
  const busy = progress !== null;
  const failure = error ?? status.error;

  const retryProcessing = () => {
    setError(null);
    if (loaded) controlRef.current?.retry?.();
    else setRetry((n) => n + 1);
  };
  const keepEditing = () => {
    setConfirm(false);
    requestAnimationFrame(() => cancelButtonRef.current?.focus());
  };
  const addRemaining = () => {
    const controller = new AbortController();
    abort.current = controller;
    setProgress(0);
    void onRemaining(controller.signal)
      .catch(() => {
        if (alive.current && !controller.signal.aborted) setError("processingFailed");
      })
      .finally(() => {
        abort.current = null;
        if (alive.current) setProgress(null);
      });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (
      !busy &&
      !confirm &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      !(e.target as HTMLElement).closest(
        "input,textarea,select,[contenteditable]:not([contenteditable=false])",
      ) &&
      controlRef.current?.shortcut?.(e.key)
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "z" &&
      !(e.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]")
    ) {
      e.preventDefault();
      e.stopPropagation();
      controlRef.current?.undo?.(e.shiftKey);
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      void save();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      requestClose();
    }
  };
  return {
    loaded,
    controlRef,
    statusChanged,
    status,
    progress,
    busy,
    failure,
    confirm,
    cancelButtonRef,
    keepButtonRef,
    requestClose,
    save,
    retryProcessing,
    keepEditing,
    addRemaining,
    onKeyDown,
  };
}
export type MediaSessionState = ReturnType<typeof useMediaSession>;
