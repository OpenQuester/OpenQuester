/**
 * Where a question/answer file is played (mirrors SIGame content placement).
 *
 * - SCREEN: takes the main stage while its content step is current.
 * - BACKGROUND: sound that plays under whatever is on the stage (audio only).
 */
export enum ContentPlacement {
  SCREEN = "screen",
  BACKGROUND = "background",
}
