import { useEffect } from "react";

/** Warn during an upload; release the listener when the owner closes. */
export function useUploadWarning(busy: boolean) {
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
}
