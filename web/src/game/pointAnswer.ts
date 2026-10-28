/** Parse the normalized coordinates accepted for point answers. */
export function parsePointAnswer(answer: string): { x: number; y: number } | null {
  const values = answer
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map(Number);
  if (values.length !== 2 || values.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) return null;
  return { x: values[0]!, y: values[1]! };
}
