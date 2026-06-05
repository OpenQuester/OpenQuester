export abstract class BaseError extends Error {
  /** Error code */
  public code: number;
  /** String literal arguments replacement */
  public textArgs: { [key: string]: any } | undefined;

  protected constructor(
    message?: string,
    code?: number,
    textArgs?: { [key: string]: any },
    options?: ErrorOptions
  ) {
    super(message, options);
    this.code = code ?? 500;
    this.textArgs = textArgs;
  }
}
