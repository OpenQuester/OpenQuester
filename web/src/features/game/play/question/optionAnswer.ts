/** Image picks stay distinguishable from text options and are judged by the showman. */
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
