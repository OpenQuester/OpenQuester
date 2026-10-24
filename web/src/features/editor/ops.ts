import {
  newId,
  type EditorPackage,
  type EditorQuestion,
  type EditorRound,
  type EditorTheme,
} from "./model";

/**
 * Pure edits on the package tree. Each returns a new package (unchanged
 * branches are shared) or the same object when the edit doesn't apply, so the
 * store can skip no-op history entries.
 */

export interface QuestionPath {
  round: EditorRound;
  roundIndex: number;
  theme: EditorTheme;
  themeIndex: number;
  question: EditorQuestion;
  index: number;
}

export interface ThemePath {
  round: EditorRound;
  roundIndex: number;
  theme: EditorTheme;
  index: number;
}

export function findQuestion(pkg: EditorPackage, id: string): QuestionPath | null {
  for (const [roundIndex, round] of pkg.rounds.entries())
    for (const [themeIndex, theme] of round.themes.entries()) {
      const index = theme.questions.findIndex((q) => q.id === id);
      if (index >= 0)
        return { round, roundIndex, theme, themeIndex, question: theme.questions[index]!, index };
    }
  return null;
}

export function findTheme(pkg: EditorPackage, id: string): ThemePath | null {
  for (const [roundIndex, round] of pkg.rounds.entries()) {
    const index = round.themes.findIndex((t) => t.id === id);
    if (index >= 0) return { round, roundIndex, theme: round.themes[index]!, index };
  }
  return null;
}

export function findRound(
  pkg: EditorPackage,
  id: string,
): { round: EditorRound; index: number } | null {
  const index = pkg.rounds.findIndex((r) => r.id === id);
  return index >= 0 ? { round: pkg.rounds[index]!, index } : null;
}

const mapRounds = (pkg: EditorPackage, fn: (r: EditorRound) => EditorRound): EditorPackage => {
  let changed = false;
  const rounds = pkg.rounds.map((r) => {
    const next = fn(r);
    if (next !== r) changed = true;
    return next;
  });
  return changed ? { ...pkg, rounds } : pkg;
};

const mapThemes = (pkg: EditorPackage, fn: (t: EditorTheme) => EditorTheme): EditorPackage =>
  mapRounds(pkg, (r) => {
    let changed = false;
    const themes = r.themes.map((t) => {
      const next = fn(t);
      if (next !== t) changed = true;
      return next;
    });
    return changed ? { ...r, themes } : r;
  });

function insertAt<T>(list: T[], index: number, item: T): T[] {
  const i = Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, i), item, ...list.slice(i)];
}

// ── Package / rounds ────────────────────────────────────────────────────────

export function updatePackage(pkg: EditorPackage, patch: Partial<EditorPackage>): EditorPackage {
  return { ...pkg, ...patch };
}

export function addRound(
  pkg: EditorPackage,
  round: EditorRound,
  index = pkg.rounds.length,
): EditorPackage {
  // A new regular round goes before the final, which must stay last.
  const finalAt = pkg.rounds.findIndex((r) => r.type === "final");
  const at = round.type !== "final" && finalAt >= 0 ? Math.min(index, finalAt) : index;
  return { ...pkg, rounds: insertAt(pkg.rounds, at, round) };
}

export function updateRound(
  pkg: EditorPackage,
  id: string,
  patch: Partial<EditorRound>,
): EditorPackage {
  return mapRounds(pkg, (r) => (r.id === id ? { ...r, ...patch } : r));
}

export function deleteRound(pkg: EditorPackage, id: string): EditorPackage {
  const rounds = pkg.rounds.filter((r) => r.id !== id);
  return rounds.length === pkg.rounds.length ? pkg : { ...pkg, rounds };
}

export function moveRound(pkg: EditorPackage, id: string, toIndex: number): EditorPackage {
  const from = pkg.rounds.findIndex((r) => r.id === id);
  if (from < 0) return pkg;
  const rest = pkg.rounds.filter((r) => r.id !== id);
  const at = toIndex > from ? toIndex - 1 : toIndex;
  if (at === from) return pkg;
  return { ...pkg, rounds: insertAt(rest, at, pkg.rounds[from]!) };
}

// ── Themes ──────────────────────────────────────────────────────────────────

export function addTheme(
  pkg: EditorPackage,
  roundId: string,
  theme: EditorTheme,
  index?: number,
): EditorPackage {
  return mapRounds(pkg, (r) =>
    r.id === roundId ? { ...r, themes: insertAt(r.themes, index ?? r.themes.length, theme) } : r,
  );
}

export function updateTheme(
  pkg: EditorPackage,
  id: string,
  patch: Partial<EditorTheme>,
): EditorPackage {
  return mapThemes(pkg, (t) => (t.id === id ? { ...t, ...patch } : t));
}

export function deleteTheme(pkg: EditorPackage, id: string): EditorPackage {
  return mapRounds(pkg, (r) => {
    const themes = r.themes.filter((t) => t.id !== id);
    return themes.length === r.themes.length ? r : { ...r, themes };
  });
}

/**
 * Moves a theme to `toIndex` in any round. `toIndex` counts positions in the
 * target round before the move, the way a drop indicator shows them.
 */
export function moveTheme(
  pkg: EditorPackage,
  id: string,
  toRoundId: string,
  toIndex: number,
): EditorPackage {
  const at = findTheme(pkg, id);
  if (!at || !findRound(pkg, toRoundId)) return pkg;
  const sameRound = at.round.id === toRoundId;
  const index = sameRound && toIndex > at.index ? toIndex - 1 : toIndex;
  if (sameRound && index === at.index) return pkg;
  return addTheme(deleteTheme(pkg, id), toRoundId, at.theme, index);
}

export function duplicateTheme(pkg: EditorPackage, id: string): { pkg: EditorPackage; id: string } {
  const at = findTheme(pkg, id);
  if (!at) return { pkg, id };
  const copy: EditorTheme = {
    ...at.theme,
    id: newId(),
    questions: at.theme.questions.map((q) => cloneQuestion(q)),
  };
  return { pkg: addTheme(pkg, at.round.id, copy, at.index + 1), id: copy.id };
}

// ── Questions ───────────────────────────────────────────────────────────────

export function cloneQuestion(q: EditorQuestion): EditorQuestion {
  return { ...q, id: newId(), options: q.options.map((o) => ({ ...o, id: newId() })) };
}

export function addQuestion(
  pkg: EditorPackage,
  themeId: string,
  q: EditorQuestion,
  index?: number,
): EditorPackage {
  return mapThemes(pkg, (t) =>
    t.id === themeId
      ? { ...t, questions: insertAt(t.questions, index ?? t.questions.length, q) }
      : t,
  );
}

export function updateQuestion(
  pkg: EditorPackage,
  id: string,
  patch: Partial<EditorQuestion>,
): EditorPackage {
  return mapThemes(pkg, (t) => {
    const i = t.questions.findIndex((q) => q.id === id);
    if (i < 0) return t;
    const questions = [...t.questions];
    questions[i] = { ...questions[i]!, ...patch, id };
    return { ...t, questions };
  });
}

export function deleteQuestion(pkg: EditorPackage, id: string): EditorPackage {
  return mapThemes(pkg, (t) => {
    const questions = t.questions.filter((q) => q.id !== id);
    return questions.length === t.questions.length ? t : { ...t, questions };
  });
}

/**
 * Moves a question into any theme of any round. `toIndex` counts positions in
 * the target theme before the move. With `keepPrices` the question takes the
 * price of the slot it lands in and the questions it passes shift, so a
 * 100–500 row stays 100–500 after reordering.
 */
export function moveQuestion(
  pkg: EditorPackage,
  id: string,
  toThemeId: string,
  toIndex: number,
  { keepPrices = false }: { keepPrices?: boolean } = {},
): EditorPackage {
  const at = findQuestion(pkg, id);
  const target = findTheme(pkg, toThemeId);
  if (!at || !target) return pkg;
  const sameTheme = at.theme.id === toThemeId;
  const index = sameTheme && toIndex > at.index ? toIndex - 1 : toIndex;
  if (sameTheme && index === at.index) return pkg;

  if (sameTheme && keepPrices) {
    const prices = at.theme.questions.map((q) => q.price);
    const reordered = insertAt(
      at.theme.questions.filter((q) => q.id !== id),
      index,
      at.question,
    ).map((q, i) => (q.price === prices[i] ? q : { ...q, price: prices[i] ?? q.price }));
    return updateTheme(pkg, toThemeId, { questions: reordered });
  }
  return addQuestion(deleteQuestion(pkg, id), toThemeId, at.question, index);
}

export function duplicateQuestion(
  pkg: EditorPackage,
  id: string,
): { pkg: EditorPackage; id: string } {
  const at = findQuestion(pkg, id);
  if (!at) return { pkg, id };
  const copy = cloneQuestion(at.question);
  return { pkg: addQuestion(pkg, at.theme.id, copy, at.index + 1), id: copy.id };
}

/** Sets every question's price in a round: base for the first, then + step. */
export function setRoundPrices(
  pkg: EditorPackage,
  roundId: string,
  base: number,
  step: number,
): EditorPackage {
  return {
    ...pkg,
    rounds: pkg.rounds.map((r) =>
      r.id !== roundId || r.type === "final"
        ? r
        : {
            ...r,
            themes: r.themes.map((t) => ({
              ...t,
              questions: t.questions.map((q, i) => ({ ...q, price: base + i * step })),
            })),
          },
    ),
  };
}

/** Adds themes at the end of a round. */
export function appendThemes(
  pkg: EditorPackage,
  roundId: string,
  themes: EditorTheme[],
): EditorPackage {
  return {
    ...pkg,
    rounds: pkg.rounds.map((r) =>
      r.id === roundId ? { ...r, themes: [...r.themes, ...themes] } : r,
    ),
  };
}

export interface SearchHit {
  roundId: string;
  roundName: string;
  themeName: string;
  question: EditorQuestion;
}

/** Questions whose text, answer, comment or extra answers contain the query. */
export function searchQuestions(pkg: EditorPackage, query: string): SearchHit[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  for (const r of pkg.rounds)
    for (const t of r.themes)
      for (const question of t.questions) {
        const haystack = [
          question.text,
          question.answerText,
          question.questionComment,
          question.answerHint,
          ...question.rightAnswers,
          ...question.options.map((o) => o.text),
          t.name,
        ]
          .join("\n")
          .toLocaleLowerCase();
        if (haystack.includes(q))
          hits.push({ roundId: r.id, roundName: r.name, themeName: t.name, question });
      }
  return hits;
}
