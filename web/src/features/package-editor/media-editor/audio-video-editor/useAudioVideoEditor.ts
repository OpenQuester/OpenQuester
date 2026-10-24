import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { MediaToolProps } from "../mediaEditorTypes";
import {
  validTrim,
  updateAudioVideoEdits,
  trimAtPlayhead,
  type AudioVideoEdits,
} from "../mediaEdits";
import { encodeEditedAudioVideo } from "../processMedia";
import { useAudioVideoSource } from "./useAudioVideoSource";
import { useAudioVideoPlayback } from "./useAudioVideoPlayback";

export type AudioVideoEditorState = ReturnType<typeof useAudioVideoEditor>;

/** Keep trim/fade history and the parent form's save protocol separate from the view. */
export function useAudioVideoEditor({ file, mime, controlRef, onStatus }: MediaToolProps) {
  const [edits, setEdits] = useState<AudioVideoEdits | null>(null);
  const [history, setHistory] = useState<{ past: AudioVideoEdits[]; future: AudioVideoEdits[] }>({
    past: [],
    future: [],
  });
  const beforeGesture = useRef<AudioVideoEdits | null>(null);
  const video = file.type === "video";
  const { meta, error, setError, visualError, setAttempt, peaks, frames } = useAudioVideoSource(
    file,
    mime,
    video,
    setEdits,
  );
  const dirty =
    !!edits &&
    !!meta &&
    (edits.start !== 0 ||
      edits.end !== meta.duration ||
      edits.mute ||
      edits.fadeIn > 0 ||
      edits.fadeOut > 0);
  const supported =
    !!meta &&
    meta.canVideo &&
    meta.decodeVideo &&
    (!meta.hasAudio || edits?.mute || (meta.canSound && meta.decodeSound));
  const valid = !!edits && !!meta && validTrim(edits, meta.duration);
  const { playerRef, position, playing, events, seek, togglePlayback } = useAudioVideoPlayback({
    edits,
    meta,
    valid,
    video,
    setError,
  });
  useEffect(() => {
    onStatus({
      dirty,
      ready: valid && !error && (!dirty || supported),
      ...(error ? { error: "processingFailed" } : {}),
    });
  }, [dirty, valid, error, supported, onStatus]);
  const undo = useCallback(
    (redo = false) => {
      if (!edits) return;
      const list = redo ? history.future : history.past;
      const next = list.at(-1);
      if (!next) return;
      beforeGesture.current = null;
      setEdits(next);
      setHistory(
        redo
          ? { past: [...history.past, edits], future: history.future.slice(0, -1) }
          : { past: history.past.slice(0, -1), future: [...history.future, edits] },
      );
    },
    [edits, history],
  );
  useEffect(() => {
    controlRef.current = {
      undo,
      retry: () => {
        setError(false);
        setAttempt((n) => n + 1);
        playerRef.current?.load();
      },
      save: async (signal, progress) => {
        if (!edits || !valid || !supported) throw new Error("unsupported");
        return {
          file: await encodeEditedAudioVideo(file, mime, edits, progress, signal),
          geometryChanged: false,
        };
      },
    };
    return () => {
      controlRef.current = null;
    };
  }, [controlRef, edits, valid, supported, file, mime, undo, playerRef, setError, setAttempt]);

  const remember = (previous: AudioVideoEdits) =>
    setHistory((h) => ({ past: [...h.past.slice(-99), previous], future: [] }));
  const finish = () => {
    if (beforeGesture.current) remember(beforeGesture.current);
    beforeGesture.current = null;
  };
  const update = (patch: Partial<AudioVideoEdits>, transient = false) => {
    if (!edits) return;
    const next = updateAudioVideoEdits(edits, patch);
    if (transient) beforeGesture.current ??= edits;
    else {
      remember(beforeGesture.current ?? edits);
      beforeGesture.current = null;
    }
    setEdits(next);
  };
  const leftTrim = edits && meta ? trimAtPlayhead(edits, "start", position, meta.duration) : null;
  const rightTrim = edits && meta ? trimAtPlayhead(edits, "end", position, meta.duration) : null;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key === " " &&
      !(event.target as HTMLElement).closest("input,textarea,select,button,[contenteditable=true]")
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (valid && !error) togglePlayback();
    }
  };
  return {
    file,
    video,
    meta,
    edits,
    error,
    visualError,
    peaks,
    frames,
    playerRef,
    position,
    playing,
    events,
    seek,
    togglePlayback,
    history,
    undo,
    finish,
    update,
    valid,
    supported,
    leftTrim,
    rightTrim,
    onKeyDown,
  };
}
