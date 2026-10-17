import { newQuestion, newTheme, type EditorTheme } from "./model";

/**
 * Questions pasted as plain text, one theme per block:
 *
 *   Capitals
 *   100. The capital of France? | Paris
 *   200 What is the capital of Japan? — Tokyo
 *   Largest city in Australia? / Answer: Sydney
 *
 *   Planets
 *   ...
 *
 * A blank line starts a new theme; the block's first line is the theme name.
 * The answer follows " | ", " — ", " - " or "Answer:". A leading price
 * ("100.", "200)", "300:") is kept; without one, prices count up from
 * `base` by `step`.
 */
export interface TextImportResult {
  themes: EditorTheme[];
  /** Lines that looked like questions but had no answer */
  missingAnswers: number;
}

const PRICE = /^\s*(\d{1,6})\s*[.):-]?\s+/;
// "Answer:" in English, Russian or Ukrainian. \b only knows Latin letters, so a
// lookbehind for "not a letter or digit" marks the start of the word instead.
const ANSWER_SPLIT =
  /\s+(?:\||—|–|-{1,2})\s+|\s*(?<![\p{L}\p{N}])(?:answer|ответ|відповідь)\s*:\s*/iu;

export function parseQuestionText(
  text: string,
  { base = 100, step = 100 }: { base?: number; step?: number } = {},
): TextImportResult {
  const themes: EditorTheme[] = [];
  let missingAnswers = 0;
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((b) =>
      b
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .filter((b) => b.length > 0);

  for (const lines of blocks) {
    const [first, ...rest] = lines;
    // A block whose first line is already a question gets an empty theme name
    const firstIsQuestion = ANSWER_SPLIT.test(first!) && rest.length === 0;
    const name = firstIsQuestion ? "" : first!.replace(/[:.]$/, "");
    const questionLines = firstIsQuestion ? lines : rest;
    const questions = questionLines.map((line, i) => {
      const price = PRICE.exec(line);
      const body = price ? line.slice(price[0].length) : line;
      const [question, ...answer] = body.split(ANSWER_SPLIT);
      const answerText = answer.join(" ").trim();
      if (!answerText) missingAnswers++;
      return newQuestion(price ? Number(price[1]) : base + i * step, {
        text: (question ?? "").trim(),
        answerText,
      });
    });
    if (questions.length) themes.push(newTheme(name, questions));
  }
  return { themes, missingAnswers };
}
