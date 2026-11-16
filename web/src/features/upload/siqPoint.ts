import type { PointTarget } from "@/lib/pointGeometry";

/** SIQuester point answer at SI revision 0c2167728f9eb66117b4c3576a05d91f9509cd8a. */
export function parseSiqPoint(
  raw: string,
  rawDeviation: string | null,
): { target: PointTarget; deviation: number } | null {
  const parts = raw.split(",").map((part) => part.trim());
  if ((parts.length !== 2 && parts.length !== 3) || parts.some((part) => !part)) return null;
  const [x, y, suppliedAspect] = parts.map(Number);
  if (
    x == null ||
    y == null ||
    ![x, y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
  )
    return null;
  const aspectRatio = parts.length === 3 ? suppliedAspect! : 1;
  const deviation = rawDeviation === null ? 0 : rawDeviation.trim() ? Number(rawDeviation) : NaN;
  if (
    !Number.isFinite(aspectRatio) ||
    aspectRatio <= 0 ||
    !Number.isFinite(deviation) ||
    deviation < 0
  )
    return null;
  return {
    target: { x, y, sourceGeometry: { kind: "sigame", aspectRatio } },
    deviation: Math.max(0.02, deviation),
  };
}

/** Resolve a source occurrence after sequence normalization. Also usable on P6's active showContent. */
export function pointTargetOrder(
  lastSourceIndex: number,
  occurrences: readonly { sourceIndex: number; order: number; kind: string }[],
): number | null {
  const matches = occurrences.filter(
    (item) => item.sourceIndex === lastSourceIndex && item.kind === "image",
  );
  return matches.length === 1 ? matches[0]!.order : null;
}
