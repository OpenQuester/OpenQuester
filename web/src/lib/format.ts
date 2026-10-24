import { i18n } from "@/i18n";

export function formatScore(n: number): string {
  return new Intl.NumberFormat(i18n.language).format(n).replace(/^-/, "−");
}

export function formatSigned(n: number): string {
  if (n > 0) return `+${formatScore(n)}`;
  if (n < 0) return formatScore(n);
  return "0";
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - Date.parse(iso);
  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" });
  const min = Math.round(diff / 60_000);
  if (Math.abs(min) < 1) return rtf.format(0, "minute");
  if (Math.abs(min) < 60) return rtf.format(-min, "minute");
  const h = Math.round(min / 60);
  if (Math.abs(h) < 24) return rtf.format(-h, "hour");
  return rtf.format(-Math.round(h / 24), "day");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
