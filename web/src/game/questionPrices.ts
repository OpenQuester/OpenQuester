interface QuestionPriceFields {
  price: number | null;
  realPrice?: number | null;
}

export function getVisiblePrice(question: QuestionPriceFields): number | null {
  return question.price;
}

export function getRealPrice(question: QuestionPriceFields | null | undefined): number | null {
  return question?.realPrice ?? question?.price ?? null;
}
