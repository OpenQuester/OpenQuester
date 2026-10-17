/** Trimmed, non-empty entries of a text list; null when nothing is left */
export function nonEmpty(list: string[] | null | undefined): string[] | null {
  const items = (list ?? []).map((item) => item.trim()).filter(Boolean);

  return items.length > 0 ? items : null;
}
