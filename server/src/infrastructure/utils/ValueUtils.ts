import { v4 as uuidv4 } from "uuid";

import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";

export class ValueUtils {
  public static isValidDate(date: Date | string | null) {
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Validates that given id is numeric and valid
   */
  public static validateId(id: string | number): number {
    id = Number(id);

    if (id < 1 || Number.isNaN(id)) {
      throw new ClientError(ClientResponse.BAD_ID_PROVIDED);
    }

    return id;
  }

  /**
   * Returns if given value can be casted as expected type or already expected type
   */
  public static checkPrimitiveType(
    value: unknown,
    expectedType: "string" | "number" | "boolean" | "array" | "object"
  ): boolean {
    let success = false;

    if (this.isBad(value)) {
      return false;
    }
    switch (expectedType) {
      case "string":
        if (this.isString(value) && !this.isEmpty(value)) success = true;
        break;
      case "number":
        if (this.isNumeric(value as number)) success = true;
        break;
      case "boolean":
        if (
          this.isBoolean(value) ||
          String(value) === "true" ||
          String(value) === "1" ||
          String(value) === "false" ||
          String(value) === "0"
        )
          success = true;
        break;
      case "array":
        if (this.isArray(value) && !this.isEmpty(value)) success = true;
        break;
      case "object":
        if (this.isObject(value) && !this.isEmpty(value)) success = true;
        break;
    }
    return success;
  }

  /**
   * Parses values to boolean, but works well only with primitive types
   *
   * Usage: `ValueUtils.parseBoolean("true")` or `ValueUtils.parseBoolean(0)`
   */
  public static parseBoolean(value: unknown): boolean {
    if (this.isBoolean(value)) return value;
    if (this.isBad(value)) return false;
    if (String(value) === "true" || String(value) === "1") return true;
    if (String(value) === "false" || String(value) === "0") return false;
    return !!value;
  }

  public static isError(value: unknown) {
    return value instanceof Error && typeof value.message !== "undefined";
  }

  public static isBad(value: unknown) {
    return value === undefined || value === null;
  }

  public static isBoolean(value: unknown) {
    return typeof value === "boolean";
  }

  /**
   * Returns true if given value can be parsed as number, examples:
   *
   * - string "24" returns `true`
   * - string "24a" returns `false`
   * - all numbers returns `true`
   */
  public static isNumeric(value: string | number | unknown) {
    return this.isNumber(value) || !isNaN(Number(value));
  }

  public static isNumber(value: unknown): value is number {
    return typeof value === "number" && isFinite(value);
  }

  public static isObject(value: unknown) {
    return !!value && typeof value === "object" && !this.isBad(value);
  }

  public static isArray(arr: unknown) {
    return Array.isArray(arr);
  }

  public static isString(value: unknown) {
    return typeof value === "string" || value instanceof String;
  }

  public static isEmpty(value: unknown) {
    return (
      (this.isString(value) && value === "") ||
      (this.isArray(value) && value.length === 0) ||
      (this.isObject(value) && Object.keys(value).length === 0)
    );
  }

  /** Removes file extension from filename */
  public static getRawFilename(filename: string): string {
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex === -1) {
      return filename;
    }
    return filename.substring(0, lastDotIndex);
  }

  public static getFileExtension(filename: string) {
    const parts = filename.split(".");
    return parts[parts.length - 1].toLowerCase();
  }

  /**
   * Validates that provided entity is non-empty object with at least one non-empty field
   */
  public static isValidObject(entity: unknown) {
    if (!this.isObject(entity) || this.isBad(entity) || this.isEmpty(entity)) {
      return false;
    }
    for (const val of Object.values(entity)) {
      // If at least one field is not empty -> it's valid object
      if (!this.isBad(val) && !this.isEmpty(val)) {
        return true;
      }
    }
    return false;
  }

  public static generateUUID() {
    return uuidv4();
  }
}
