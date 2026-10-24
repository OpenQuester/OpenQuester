import { layoutStyles } from "@/ui/layoutStyles";

const panel = "flex flex-col rounded-md border border-line bg-surface px-4 py-3";
const detailSection = "flex flex-col gap-4 border-t border-line pt-4";

export const adminStyles = {
  listPage: "flex flex-col gap-5",
  list: layoutStyles.list,
  row: "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md border border-line bg-surface px-4 py-3",
  stat: `${panel} gap-1`,
  game: `${panel} gap-3`,
  gameDetails: detailSection,
  staffPermissions: `${detailSection} w-full`,
  gameLink:
    "inline-flex min-h-10 items-center rounded-sm px-3 text-sm font-semibold text-accent hover:underline",
  userQuota: "flex flex-wrap items-center gap-3 rounded-[12px] bg-surface-2 px-4 py-3",
  playerName: "min-w-0 flex-[1_1_140px] truncate font-medium",
  gameSummary: "flex min-w-0 flex-[1_1_220px] flex-col",
  packageSummary: "flex min-w-0 flex-[1_1_240px] flex-col",
  permissionGrid: "grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-x-4 gap-y-1",
  permissionCheckbox: "h-5 w-5 shrink-0 accent-[var(--oq-accent)]",
  quotaSummary: "flex min-w-[180px] flex-1 flex-col",
} as const;
