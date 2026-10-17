import { describe, expect, it } from "vitest";

import en from "./locales/en.json";
import ru from "./locales/ru.json";
import uk from "./locales/uk.json";

type Tree = { [key: string]: string | Tree };

/** Keys with plural suffixes folded together, so languages may add plural forms. */
function keys(tree: Tree, prefix = ""): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(tree)) {
    const key = `${prefix}${k.replace(/_(zero|one|two|few|many|other)$/, "")}`;
    if (typeof v === "string") out.add(key);
    else for (const child of keys(v, `${key}.`)) out.add(child);
  }
  return out;
}

describe("translations", () => {
  const base = [...keys(en as Tree)].sort();
  it.each([
    ["uk", uk],
    ["ru", ru],
  ])("%s has every English key and no extras", (_lang, tree) => {
    expect([...keys(tree as Tree)].sort()).toEqual(base);
  });
});
