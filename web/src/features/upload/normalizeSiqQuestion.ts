import { sourceFromSiq } from "./siqCompatibility";
import { SECRET_PRICE_CAP, type SecretPriceRule, type SecretRules } from "@/game/secretRules";
import type { FileRef, ImportWarning, MediaType, UploadQuestion } from "./types";

export interface SiqQuestionCoordinates {
  round: number;
  theme: number;
  question: number;
}

interface NormalizedSiqKind {
  rawType: string;
  fields: Partial<UploadQuestion> & Pick<UploadQuestion, "type">;
  issues: ImportWarning[];
}

const elements = (node: Element | null, name: string): Element[] =>
  Array.from(node?.children ?? []).filter((item) => item.localName === name);
const child = (node: Element | null, name: string) => elements(node, name)[0] ?? null;
const value = (node: Element | null) => node?.textContent?.trim() ?? "";
const integer = (raw: string): number | null =>
  /^\d+$/.test(raw.trim()) && Number.isSafeInteger(Number(raw)) && Number(raw) <= SECRET_PRICE_CAP
    ? Number(raw)
    : null;

/** NumberSet XML has continuous step=0; legacy cost without /h has endpoints only. */
export function normalizeSecretPrice(
  min: number,
  max: number,
  step: number,
): { realPrice?: number; priceRule: SecretPriceRule | null } | null {
  if (
    ![min, max, step].every((n) => Number.isSafeInteger(n) && n >= 0 && n <= SECRET_PRICE_CAP) ||
    min > max
  )
    return null;
  if (min === max)
    return min === 0
      ? { priceRule: { kind: "roundExtremes" } }
      : { realPrice: min, priceRule: null };
  return { priceRule: { kind: "range", min, max, step } };
}

export function normalizeLegacySecretCost(raw: string) {
  const fixed = integer(raw);
  if (fixed !== null) return normalizeSecretPrice(fixed, fixed, 0);
  const match = /^\[\s*(\d+)\s*;\s*(\d+)\s*\](?:\s*\/\s*(\d+))?$/.exec(raw.trim());
  if (!match) return null;
  const min = integer(match[1]!);
  const max = integer(match[2]!);
  if (min === null || max === null) return null;
  const step = match[3] == null ? max - min : integer(match[3]);
  return step === null ? null : normalizeSecretPrice(min, max, step);
}

/** One modern/legacy kind boundary; input format remains independent of mechanics. */
export function normalizeSiqQuestion(
  q: Element,
  where: string,
  final: boolean,
  resolveFile?: (type: MediaType, name: string) => FileRef | null,
  sourceCoordinates?: SiqQuestionCoordinates,
  scriptHandled = false,
): NormalizedSiqKind {
  const legacy = child(q, "type");
  const rawType = (q.getAttribute("type") ?? legacy?.getAttribute("name") ?? "").trim();
  const params = elements(child(q, "params"), "param");
  const legacyParams = elements(legacy, "param");
  const modernParam = (name: string) => params.find((p) => p.getAttribute("name") === name) ?? null;
  const legacyParam = (name: string) =>
    value(legacyParams.find((p) => p.getAttribute("name") === name) ?? null);
  const issues: ImportWarning[] = [];
  const source = sourceCoordinates ?? {
    round: elements(q.closest("rounds"), "round").indexOf(q.closest("round")!),
    theme: elements(q.closest("themes"), "theme").indexOf(q.closest("theme")!),
    question: elements(q.parentElement, "question").indexOf(q),
  };
  let retainedSource: ReturnType<typeof sourceFromSiq> | undefined;
  const issue = (parameter: string) => {
    if (scriptHandled) return;
    const sourceData = (retainedSource ??= sourceFromSiq(q, resolveFile));
    issues.push({
      code: "siqCompatibility",
      where,
      detail: rawType ? `${rawType}: ${parameter}` : parameter,
      severity: "critical",
      resolution: "needsRepair",
      source: { ...source, parameter },
      sourceData,
    });
  };
  let fields: NormalizedSiqKind["fields"];
  switch (rawType) {
    case "":
    case "default":
    case "simple":
    case "withButton":
      fields = { type: "simple" };
      break;
    case "choice":
      fields = { type: "choice" };
      break;
    case "auction":
    case "stake":
      fields = { type: "stake", subType: "simple", maxPrice: null };
      break;
    case "stakeAll":
      fields = { type: "stake", subType: "forEveryone", maxPrice: null };
      break;
    case "forAll":
      fields = { type: "simple", subType: "forEveryone" };
      break;
    case "sponsored":
    case "noRisk":
    case "forYourself":
      fields = { type: "noRisk", subType: "simple", priceMultiplier: 2 };
      break;
    case "secret":
    case "cat":
    case "bagcat":
    case "secretPublicPrice":
    case "secretOpenerPrice":
    case "secretNoQuestion": {
      const oldCat = rawType === "cat" || rawType === "bagcat";
      const self = legacyParam("self");
      const knows = rawType === "bagcat" ? legacyParam("knows") || "after" : "after";
      const selection = oldCat
        ? rawType === "bagcat" && self === "true"
          ? "any"
          : "exceptCurrent"
        : value(modernParam("selectionMode")) || "exceptCurrent";
      if (!oldCat && selection !== "any" && selection !== "exceptCurrent") issue("selectionMode");
      if (rawType === "bagcat" && self && self !== "true" && self !== "false") issue("self");
      if (!["before", "after", "never"].includes(knows)) issue("knows");
      const rules: SecretRules = {
        outcome: rawType === "secretNoQuestion" || knows === "never" ? "award" : "question",
        priceAnnouncement:
          rawType === "secretPublicPrice" || rawType === "secretOpenerPrice" || knows === "before"
            ? "beforeTransfer"
            : "afterTransfer",
        priceChooser: rawType === "secretOpenerPrice" ? "opener" : "receiver",
        priceRule: null,
      };
      let price: ReturnType<typeof normalizeSecretPrice>;
      if (oldCat) price = normalizeLegacySecretCost(legacyParam("cost") || "0");
      else {
        const parameter = modernParam("price");
        const numberSet = child(parameter, "numberSet");
        if (!parameter) price = { priceRule: { kind: "roundExtremes" } };
        else if (
          numberSet &&
          parameter.getAttribute("type") === "numberSet" &&
          parameter.getAttribute("isRef")?.toLowerCase() !== "true"
        ) {
          const min = integer(numberSet.getAttribute("minimum") ?? "0");
          const max = integer(numberSet.getAttribute("maximum") ?? "0");
          const step = integer(numberSet.getAttribute("step") ?? "0");
          price =
            min === null || max === null || step === null
              ? null
              : normalizeSecretPrice(min, max, step);
        } else price = null;
      }
      if (!price) issue(oldCat ? "cost" : "price");
      rules.priceRule = price?.priceRule ?? null;
      fields = {
        type: "secret",
        subType: "simple",
        transferType: selection === "any" ? "any" : "exceptCurrent",
        secretRules: rules,
        ...(price?.realPrice === undefined ? {} : { realPrice: price.realPrice }),
      };
      break;
    }
    default:
      fields = { type: "simple" };
      issue("type");
  }
  if (child(q, "script")) issue("script"); // P6 owns compilation; never run a different script silently.
  if (final && rawType && !["default", "simple", "withButton", "choice"].includes(rawType))
    issue("finalType");
  return { rawType, fields: final ? { type: "simple" } : fields, issues };
}
