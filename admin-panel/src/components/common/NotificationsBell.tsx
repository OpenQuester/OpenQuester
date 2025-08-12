import { Bell, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { IconButton } from "@/components/common/IconButton";
import { Portal } from "@/components/common/Portal";
import { useToast } from "@/contexts/ToastContext";

export const NotificationsBell = () => {
  const { notifications, markRead, markAllRead } = useToast();
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.length;
  const btnRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; right: number }>({
    top: 0,
    right: 0,
  });

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [open]);

  // Outside click & Escape handling
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  return (
    <div className="relative" ref={btnRef}>
      <IconButton
        ariaLabel="Notifications"
        onClick={() => setOpen((o) => !o)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-error-600 text-white rounded-full text-[10px] px-1.5 py-0.5 font-semibold shadow">
            {unreadCount}
          </span>
        )}
      </IconButton>
      {open && (
        <Portal id="notifications-portal-root">
          <div
            ref={panelRef}
            className="fixed w-80 max-h-96 overflow-auto rounded-lg border border-border bg-card/95 backdrop-blur-md shadow-2xl shadow-black/10 z-[9998] animate-fade-in text-secondaryText"
            style={{ top: position.top, right: position.right }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-hover/40 rounded-t-lg">
              <p className="text-sm font-medium text-primaryText">
                Notifications
              </p>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-primary-400 hover:text-primary-300 hover:underline flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                  >
                    <Check className="h-3 w-3" /> Mark all as read
                  </button>
                )}
              </div>
            </div>
            <ul className="divide-y divide-border/60">
              {unreadCount === 0 && (
                <li className="p-4 text-xs text-mutedText text-center">
                  No notifications
                </li>
              )}
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="p-3 flex gap-3 group hover:bg-hover transition-colors"
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${variantDot(
                      n.variant
                    )}`}
                  ></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-snug line-clamp-2 text-primaryText">
                      {n.title}
                    </p>
                    {n.description && (
                      <p className="text-[11px] text-secondaryText mt-0.5 leading-snug break-words line-clamp-3">
                        {n.description}
                      </p>
                    )}
                    <p className="text-[10px] mt-1 text-mutedText">
                      {formatTime(n.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => markRead(n.id)}
                    className="opacity-70 hover:opacity-100 transition-opacity text-[12px] text-secondaryText hover:text-primaryText focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                    title="Mark read"
                  >
                    <Check className="h-4 w-4 text-green-500" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Portal>
      )}
    </div>
  );
};

const variantDot = (variant: string) => {
  switch (variant) {
    case "error":
      return "bg-error-500";
    case "success":
      return "bg-success-500";
    case "warning":
      return "bg-warning-500";
    case "info":
    default:
      return "bg-primary-500";
  }
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
