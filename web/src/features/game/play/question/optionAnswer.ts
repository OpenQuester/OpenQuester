/** Media-only picks use a label that stays distinguishable from text options. */
export function optionAnswer(
  text: string | null | undefined,
  index: number,
  options: readonly { text?: string | null }[],
): string {
  if (text?.trim()) return text.trim();
  const texts = new Set(
    options.map((option) => (option.text ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase()),
  );
  let answer = String(index + 1);
  while (texts.has(answer)) answer = `#${answer}`;
  return answer;
}

/** Legacy numeric text can also be a media-only option's display placeholder. */
export function ambiguousMediaPlaceholder(
  options: readonly { text?: string | null; order: number; file?: { type: string } | null }[],
  answer: string,
): boolean {
  const normalized = answer.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return [...options]
    .sort((a, b) => a.order - b.order)
    .some(
      (option, index) => !!option.file && !option.text?.trim() && normalized === String(index + 1),
    );
}
