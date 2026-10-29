/** Select a question image by its public file order; old questions use the first image. */
export function pointImage<T extends { order: number; file: { type: string } }>(
  files: readonly T[] | null | undefined,
  order: number | null | undefined,
): T | undefined {
  const images = (files ?? []).filter((item) => item.file.type === "image");
  if (order == null) return [...images].sort((a, b) => a.order - b.order)[0];
  const matches = images.filter((item) => item.order === order);
  return matches.length === 1 ? matches[0] : undefined;
}
