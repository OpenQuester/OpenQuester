import { memo } from "react";

/**
 * Badge component to indicate new users (created within 2 weeks)
 */
export const NewBadge = memo(() => (
  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-gradient-to-r from-green-500/90 to-emerald-600/90 text-white shadow-sm ring-1 ring-inset ring-white/20">
    New
  </span>
));

NewBadge.displayName = "NewBadge";
