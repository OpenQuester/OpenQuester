import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: ReactNode;
  id?: string;
  className?: string;
}

/**
 * Lightweight portal utility to render children at document.body level.
 * Prevents ancestor stacking contexts (e.g., transforms, filters, opacity) from
 * interfering with overlay layering.
 */
export const Portal = ({ children, id, className }: PortalProps) => {
  const elRef = useRef<HTMLDivElement | null>(null);
  if (!elRef.current) {
    const el = document.createElement("div");
    if (id) el.id = id;
    if (className) el.className = className;
    elRef.current = el;
  }
  useEffect(() => {
    const el = elRef.current!;
    document.body.appendChild(el);
    return () => {
      document.body.removeChild(el);
    };
  }, []);
  return createPortal(children, elRef.current!);
};
