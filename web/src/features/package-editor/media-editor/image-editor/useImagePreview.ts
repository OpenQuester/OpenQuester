import { useEffect, useMemo, useState } from "react";
import type { MediaFile } from "@/features/upload/types";
import { imageChanged, type ImageEdits } from "../mediaEdits";
import { encodeEditedImage } from "../processMedia";
import { isStillImage } from "@/features/upload/archive";

export type EncodedImagePreview = { edits: ImageEdits; file: MediaFile };

/** Own source bitmaps and the latest encoded preview; a draft gesture never encodes. */
export function useImagePreview(
  file: MediaFile,
  mime: string,
  edits: ImageEdits,
  draft: ImageEdits | null,
) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Animation detection may scan a large file; gestures only change edits, not bytes.
  const supported = useMemo(
    () =>
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined" &&
      isStillImage(file.bytes, mime),
    [file.bytes, mime],
  );
  const [preview, setPreview] = useState<EncodedImagePreview | null>(null);
  const blurSupported =
    typeof OffscreenCanvas !== "undefined" &&
    "filter" in new OffscreenCanvas(1, 1).getContext("2d")!;
  const dirty = imageChanged(edits);
  useEffect(() => {
    if (!supported) return;
    let alive = true;
    let image: ImageBitmap | undefined;
    createImageBitmap(new Blob([file.bytes as BlobPart], { type: mime }))
      .then((b) => {
        image = b;
        if (alive) setBitmap(b);
        else b.close();
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
      image?.close();
    };
  }, [file, mime, supported, attempt]);

  useEffect(() => {
    if (!bitmap || !dirty || draft) return;
    const controller = new AbortController();
    // There is only one active worker and one debounced latest request. Superseded work is terminated.
    const timer = window.setTimeout(() => {
      encodeEditedImage(file, mime, edits, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            setError(false);
            setPreview({ edits, file: result });
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setError(true);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [file, mime, bitmap, dirty, edits, draft, attempt]);

  return { bitmap, preview, supported, blurSupported, error, setError, setAttempt };
}
