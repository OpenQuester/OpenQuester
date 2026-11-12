interface QuestionPriceFields {
  price: number | null;
  realPrice?: number | null;
}

/** The nominal value of the board cell, including hidden/final null prices. */
export function getVisiblePrice(question: QuestionPriceFields): number | null {
  return question.price;
}

/** The actual base value; an authored or resolved zero must stay zero. */
export function getRealPrice(question: QuestionPriceFields | null | undefined): number | null {
  return question?.realPrice ?? question?.price ?? null;
}
