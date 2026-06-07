/** Pure text-template helpers safe for domain logic. */
export class TemplateUtils {
  /**
   * Replace all given arguments in provided text.
   *
   * Argument pattern "%someArg" -> replace with `{ someArg: "replacement" }`.
   */
  public static text(text: string, args: Record<string, unknown>): string {
    return text.replace(/%(\w+)/g, (_, key: string) => {
      return key in args ? String(args[key]) : `%${key}`;
    });
  }
}
