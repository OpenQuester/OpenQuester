import { useEffect, useState, type RefObject } from "react";
import type { DraftPackage } from "../packageDraft";
import { usePackageEditor } from "../packageEditorStore";
import { useStagedMedia } from "../media-editor/useStagedMedia";

/** Stages metadata and logo edits until one package-history commit. */
export function usePackageDetails(
  onClose: () => void,
  requestCloseRef: RefObject<(() => void) | null>,
) {
  const pkg = usePackageEditor((s) => s.pkg);
  const apply = usePackageEditor((s) => s.apply);
  const [details, setDetails] =
    useState<
      Pick<
        DraftPackage,
        "title" | "description" | "language" | "ageRestriction" | "authors" | "sources" | "logo"
      >
    >(pkg);
  const [tags, setTags] = useState(pkg.tags.join(", "));
  const media = useStagedMedia();
  const [confirmClose, setConfirmClose] = useState(false);
  const dirty = details !== pkg || tags !== pkg.tags.join(", ");
  useEffect(() => {
    requestCloseRef.current = () =>
      media.active ? media.closeRef.current?.() : dirty ? setConfirmClose(true) : onClose();
    return () => {
      requestCloseRef.current = null;
    };
  }, [requestCloseRef, media.active, media.closeRef, dirty, onClose]);
  const save = () => {
    if (media.active) return;
    const tagList = [
      ...new Set(
        tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    apply(
      (p) => ({ ...p, ...details, tags: tagList }),
      { key: "detailsSaved" },
      media.pending.values(),
    );
    onClose();
  };

  return { details, setDetails, tags, setTags, media, confirmClose, setConfirmClose, save };
}
