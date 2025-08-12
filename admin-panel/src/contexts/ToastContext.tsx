import { Portal } from "@/components/common/Portal";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "success" | "error" | "info" | "warning";
  duration?: number; // ms
  id?: string;
}

export interface Toast extends Required<Omit<ToastOptions, "duration">> {
  duration: number;
  createdAt: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  variant: Toast["variant"];
  createdAt: number;
  read: boolean;
}

interface ToastContextValue {
  push: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
  clear: () => void;
  toasts: Toast[];
  notifications: NotificationItem[];
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};

let counter = 0;
const genId = () => `t_${Date.now()}_${++counter}`;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timers = useRef<Record<string, number>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timers.current[id];
    if (handle) {
      window.clearTimeout(handle);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (opts: ToastOptions) => {
      const id = opts.id || genId();
      const toast: Toast = {
        title: opts.title ?? "",
        description: opts.description ?? "",
        variant: opts.variant ?? "info",
        duration: opts.duration ?? 4000,
        id,
        createdAt: Date.now(),
      };
      setToasts((prev) => [...prev, toast]);
      // Mirror as notification (persist until read)
      setNotifications((prev) => [
        ...prev,
        {
          id,
          title: toast.title || toast.variant.toUpperCase(),
          description: toast.description,
          variant: toast.variant,
          createdAt: toast.createdAt,
          read: false,
        },
      ]);
      timers.current[id] = window.setTimeout(() => dismiss(id), toast.duration);
      return id;
    },
    [dismiss]
  );

  const clear = useCallback(() => {
    Object.values(timers.current).forEach((h) => window.clearTimeout(h));
    timers.current = {};
    setToasts([]);
    setNotifications([]);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.filter((n) => {
        if (n.id === id) {
          return false; // remove when read
        }
        return true;
      })
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <ToastContext.Provider
      value={{
        push,
        dismiss,
        clear,
        toasts,
        notifications,
        markRead,
        markAllRead,
      }}
    >
      {children}
      <Portal id="toast-root">
        <ToastViewport toasts={toasts} onDismiss={dismiss} />
      </Portal>
    </ToastContext.Provider>
  );
};

// Toast UI
// Dark, subtle, less shiny styles. We keep a thin border + solid dark surface variant.
const variantStyles: Record<Toast["variant"], string> = {
  success:
    "border border-success-600/40 bg-success-800 text-success-50 shadow-lg shadow-black/30",
  error:
    "border border-error-600/40 bg-error-800 text-error-50 shadow-lg shadow-black/30",
  info: "border border-primary-600/40 bg-primary-800 text-primary-50 shadow-lg shadow-black/30",
  warning:
    "border border-warning-600/40 bg-warning-800 text-warning-50 shadow-lg shadow-black/30",
};

const iconFor: Record<Toast["variant"], React.ReactNode> = {
  success: <span className="font-semibold">✓</span>,
  error: <span className="font-semibold">⚠</span>,
  info: <span className="font-semibold">ℹ</span>,
  warning: <span className="font-semibold">!</span>,
};

const ToastViewport: React.FC<{
  toasts: Toast[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Click outside + Escape to dismiss latest toast
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && toasts.length) {
        onDismiss(toasts[toasts.length - 1].id);
      }
    };
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        // dismiss newest first
        if (toasts.length) onDismiss(toasts[toasts.length - 1].id);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [toasts, onDismiss]);

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999] inset-0 pointer-events-none flex flex-col items-end space-y-2 p-3 sm:p-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`group pointer-events-auto w-full max-w-sm rounded-md px-4 py-3 flex gap-3 toast-enter backdrop-blur-sm ${
            variantStyles[t.variant]
          } transition shadow-xl`}
        >
          <div className="mt-0.5 text-base leading-none flex-shrink-0">
            {iconFor[t.variant]}
          </div>
          <div className="flex-1 min-w-0">
            {t.title && (
              <p className="text-sm font-semibold mb-0.5 leading-snug">
                {t.title}
              </p>
            )}
            {(t.description || t.variant === "error") && (
              <p className="text-xs/5 opacity-90 break-words leading-snug">
                {t.description || t.title || "Error"}
              </p>
            )}
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-[13px] font-semibold opacity-70 hover:opacity-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export const toastMessageFromError = (err: unknown): string => {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  const unwrap = (e: any): any => (e?.cause ? unwrap(e.cause) : e);
  const original: any = unwrap(err as any);
  const data = original?.response?.data || original?._raw || original?.data;
  const candidates: string[] = [];
  const pushVal = (v?: any) => {
    if (typeof v === "string" && v.trim()) candidates.push(v.trim());
  };
  if (data) {
    pushVal(data.message);
    pushVal(data.error);
    pushVal(data.detail);
    if (Array.isArray(data.errors)) {
      for (const e of data.errors) {
        if (typeof e === "string") pushVal(e);
        else if (e?.message) pushVal(e.message);
      }
    }
  }
  // Fallback to wrapped + original messages after raw server fields
  if ((err as any).message) pushVal((err as any).message);
  if (original && original !== err && original.message)
    pushVal(original.message);
  const first = candidates.find(Boolean);
  if (first) return truncate(first, 300);
  try {
    return truncate(JSON.stringify(err), 300);
  } catch {
    return "Error";
  }
};

const truncate = (s: string, max: number) =>
  s.length > max ? s.slice(0, max - 1) + "…" : s;
