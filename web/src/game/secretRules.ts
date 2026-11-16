export type SecretPriceRule =
  { kind: "roundExtremes" } | { kind: "range"; min: number; max: number; step: number };

export interface SecretRules {
  outcome: "question" | "award";
  priceAnnouncement: "beforeTransfer" | "afterTransfer";
  priceChooser: "opener" | "receiver";
  priceRule: SecretPriceRule | null;
}

export const SECRET_PRICE_CAP = 1_000_000;

export function validSecretPriceRule(rule: SecretPriceRule | null): boolean {
  return (
    rule === null ||
    rule.kind === "roundExtremes" ||
    (rule.kind === "range" &&
      [rule.min, rule.max, rule.step].every(
        (value) => Number.isSafeInteger(value) && value >= 0 && value <= SECRET_PRICE_CAP,
      ) &&
      rule.min < rule.max)
  );
}

/** Validates archives too; unknown keys cannot hide a fixed price or unsupported rule. */
export function readSecretRules(value: unknown): SecretRules | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("badSecretRules");
  const r = value as Record<string, unknown>;
  const keys = ["outcome", "priceAnnouncement", "priceChooser", "priceRule"];
  if (
    Object.keys(r).some((key) => !keys.includes(key)) ||
    !["question", "award"].includes(String(r.outcome)) ||
    !["beforeTransfer", "afterTransfer"].includes(String(r.priceAnnouncement)) ||
    !["opener", "receiver"].includes(String(r.priceChooser)) ||
    !("priceRule" in r)
  )
    throw new Error("badSecretRules");
  const rule = r.priceRule;
  if (rule !== null) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) throw new Error("badSecretRules");
    const p = rule as Record<string, unknown>;
    const ruleKeys = p.kind === "roundExtremes" ? ["kind"] : ["kind", "min", "max", "step"];
    if (
      Object.keys(p).some((key) => !ruleKeys.includes(key)) ||
      !validSecretPriceRule(p as SecretPriceRule)
    )
      throw new Error("badSecretRules");
  }
  if (
    (r.priceChooser === "opener" && r.priceAnnouncement !== "beforeTransfer") ||
    (r.outcome === "award" &&
      (r.priceChooser !== "receiver" || r.priceAnnouncement !== "afterTransfer"))
  )
    throw new Error("badSecretRules");
  return structuredClone(r) as unknown as SecretRules;
}

export function allowedSecretPrice(
  selection: { allowedPrices: number[]; range?: { min: number; max: number; step: number } | null },
  price: number,
): boolean {
  if (!Number.isSafeInteger(price) || price < 0 || price > SECRET_PRICE_CAP) return false;
  const range = selection.range;
  return range
    ? price >= range.min &&
        price <= range.max &&
        (range.step === 0 || (price - range.min) % range.step === 0)
    : selection.allowedPrices.includes(price);
}
