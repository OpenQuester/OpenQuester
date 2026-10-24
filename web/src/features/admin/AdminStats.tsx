import { adminStyles } from "./adminStyles";
export function AdminStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={adminStyles.stat}>
      <span className="font-display text-2xl font-extrabold">{value}</span>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}

export const statGrid = "grid grid-cols-[repeat(auto-fill,minmax(min(160px,100%),1fr))] gap-3";
