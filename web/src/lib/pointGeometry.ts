/** Private answer target; measured image geometry and SIQ checking geometry are independent. */
export interface PointTarget {
  x: number;
  y: number;
  imageAspectRatio?: number;
  sourceGeometry?: { kind: "sigame"; aspectRatio: number };
}

export function pointAnswerRadius(
  target: PointTarget | null | undefined,
  deviation: number | null | undefined,
): number {
  return target?.sourceGeometry ? Math.max(0.02, deviation ?? 0) : (deviation ?? 0.05);
}
