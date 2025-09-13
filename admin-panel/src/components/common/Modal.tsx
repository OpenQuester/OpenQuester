import { type ReactNode, useEffect, useRef } from "react";

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export const Modal = ({
  isOpen,
  title,
  onClose,
  children,
  footer,
  size = "md",
}: ModalProps) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const getSizeClass = (size: string) => {
    switch (size) {
      case "sm":
        return "max-w-md";
      case "lg":
        return "max-w-2xl";
      case "xl":
        return "max-w-4xl";
      case "md":
      default:
        return "max-w-lg";
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    // Prevent body scroll when modal is open
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";

    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      // Restore original body overflow when modal closes
      document.body.style.overflow = originalStyle;
      window.removeEventListener("keydown", handleKey);
      prev?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm z-70"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={`relative w-full ${getSizeClass(
          size
        )} bg-surface rounded-xl shadow-xl border border-border animate-scale-in focus:outline-none`}
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3
            id="modal-title"
            className="text-lg font-semibold text-primaryText"
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-secondaryText hover:text-primaryText hover:bg-hover focus-ring"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-6 py-5 text-sm text-secondaryText space-y-4">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-border bg-card rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
