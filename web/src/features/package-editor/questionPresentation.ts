import type { DraftQuestion } from "./packageDraft";

export function questionTypeDetail(
  q: DraftQuestion,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  switch (q.type) {
    case "stake":
      return [
        q.maxPrice != null
          ? t("editor.preview.maxBid", { max: q.maxPrice })
          : t("editor.preview.allIn"),
        q.forEveryone ? t("editor.preview.everyone") : "",
      ]
        .filter(Boolean)
        .join(" · ");
    case "secret":
      return [
        q.allowedPrices.length ? q.allowedPrices.join(" / ") : "",
        t(`editor.form.transfer.${q.transferType}`),
      ]
        .filter(Boolean)
        .join(" · ");
    case "noRisk":
      return [`×${q.priceMultiplier}`, q.forEveryone ? t("editor.preview.everyone") : ""]
        .filter(Boolean)
        .join(" · ");
    default:
      return "";
  }
}
