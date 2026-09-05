import { readFileSync, readdirSync } from "node:fs";

/**
 * Fails when any locale is missing a key that en.json defines, or defines one
 * en.json does not. Missing keys silently fall back to English, so nothing at
 * runtime reveals the gap — this check is the only thing that does.
 */
const localesUrl = new URL("../src/i18n/locales/", import.meta.url);

function flatten(value, prefix = "") {
  return Object.entries(value).flatMap(([key, item]) =>
    item !== null && typeof item === "object"
      ? flatten(item, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function load(name) {
  return JSON.parse(readFileSync(new URL(name, localesUrl), "utf8"));
}

const reference = new Set(flatten(load("en.json")));
const locales = readdirSync(localesUrl).filter(
  (name) => name.endsWith(".json") && name !== "en.json",
);

let failed = false;
for (const locale of locales) {
  const keys = new Set(flatten(load(locale)));
  const missing = [...reference].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !reference.has(key));
  if (missing.length) {
    failed = true;
    console.error(`${locale} is missing ${missing.length} key(s):`);
    for (const key of missing) console.error(`  - ${key}`);
  }
  if (extra.length) {
    failed = true;
    console.error(`${locale} defines ${extra.length} unknown key(s):`);
    for (const key of extra) console.error(`  + ${key}`);
  }
  if (!missing.length && !extra.length)
    console.log(`${locale}: ${keys.size} keys, in sync with en.json`);
}

if (failed) process.exit(1);
