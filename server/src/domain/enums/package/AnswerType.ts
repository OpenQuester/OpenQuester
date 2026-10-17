/** How a question's answer is given and checked */
export enum AnswerType {
  /** Said or typed; the showman judges (the default) */
  TEXT = "text",
  /** A number, checked against `answerNumber` within `answerDeviation` */
  NUMBER = "number",
  /**
   * A spot on the question's picture, sent as "x,y" fractions of its width
   * and height; checked against `answerPoint` within `answerDeviation`
   */
  POINT = "point"
}
