import { describe, expect, it } from "@jest/globals";
import { uploadPackageScheme } from "presentation/schemes/package/packageSchemes";

const rules = {
  outcome: "question",
  priceAnnouncement: "afterTransfer",
  priceChooser: "receiver",
  priceRule: { kind: "range", min: 100, max: 1000000, step: 0 }
};
const question = {
  type: "secret",
  subType: "simple",
  transferType: "exceptCurrent",
  price: 100,
  order: 0,
  text: "Q",
  answerText: "A",
  showAnswerDuration: 5000
};
function accepts(patch: Record<string, unknown>) {
  return !uploadPackageScheme().validate({
    content: {
      title: "Secret rules",
      ageRestriction: "NONE",
      rounds: [
        {
          name: "Round",
          type: "simple",
          order: 0,
          themes: [{ name: "Cell", order: 0, questions: [{ ...question, ...patch }] }]
        }
      ]
    }
  }).error;
}

describe("secretRules package boundary", () => {
  it("allows an empty award only with a complete valid secret rule", () => {
    expect(
      accepts({
        secretRules: { ...rules, outcome: "award", priceRule: null },
        realPrice: 0,
        text: null,
        answerText: null
      })
    ).toBe(true);
    expect(accepts({ secretRules: rules, text: null, answerText: null })).toBe(false);
    expect(
      accepts({
        secretRules: { ...rules, outcome: "award", priceRule: null },
        answerType: "point",
        answerPoint: null,
        text: null,
        answerText: null
      })
    ).toBe(true);
    expect(
      accepts({
        secretRules: { ...rules, outcome: "award", priceRule: null },
        answerType: "number",
        answerNumber: null,
        text: null,
        answerText: null
      })
    ).toBe(true);
    expect(
      accepts({
        secretRules: { ...rules, outcome: "award", priceAnnouncement: "beforeTransfer" },
        text: null,
        answerText: null
      })
    ).toBe(false);
    expect(accepts({ type: "simple", secretRules: rules })).toBe(false);
    expect(accepts({ answerType: "number", answerNumber: null })).toBe(false);
    expect(accepts({ answerType: "point", answerPoint: null })).toBe(false);
  });
  it("rejects dynamic/fixed/list conflicts and unsafe numeric boundaries", () => {
    expect(accepts({ secretRules: rules })).toBe(true);
    expect(accepts({ secretRules: rules, realPrice: 0 })).toBe(false);
    expect(accepts({ secretRules: rules, subType: "customPrice", allowedPrices: [100, 500] })).toBe(
      false
    );
    expect(accepts({ subType: "customPrice", allowedPrices: [100, 500], realPrice: 0 })).toBe(
      false
    );
    for (const priceRule of [
      { kind: "range", min: 100, max: 100, step: 0 },
      { kind: "range", min: -1, max: 500, step: 1 },
      { kind: "range", min: 1, max: 1000001, step: 0 },
      { kind: "range", min: 1, max: 500, step: 1.5 },
      { kind: "range", min: 1, max: 500, step: Number.MAX_SAFE_INTEGER }
    ])
      expect(accepts({ secretRules: { ...rules, priceRule } })).toBe(false);
  });
  it("keeps the legacy 2–5 list contract and forbids archive repair metadata", () => {
    expect(accepts({ subType: "customPrice", allowedPrices: [100, 500] })).toBe(true);
    expect(accepts({ subType: "customPrice", allowedPrices: [100] })).toBe(false);
    expect(accepts({ subType: "customPrice", allowedPrices: [1, 2, 3, 4, 5, 6] })).toBe(false);
    expect(
      accepts({ compatibilityIssues: [{ code: "siqCompatibility", severity: "critical" }] })
    ).toBe(false);
  });
});
