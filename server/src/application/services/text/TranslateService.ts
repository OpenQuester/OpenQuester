import fs from "fs";
import { IncomingHttpHeaders } from "http";
import path from "path";

import { Language, Translation } from "domain/types/text/translation";
import { type ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Static service that handles translations from `storage/language/*.json` files by translation key
 */
export class TranslateService {
  private static _translationsPath = path.join(
    process.cwd(),
    "storage/language"
  );
  private static _translationsMap = new Map<Language, Translation>();
  private static _translationKeys: string[] = [];
  private static _logger: ILogger;

  public static setLogger(logger: ILogger) {
    this._logger = logger;
  }

  public static async initialize(): Promise<void> {
    try {
      await this._loadTranslation("en");
      await this._loadTranslationKeys();
      this._logger?.info("TranslateService initialized successfully", {
        prefix: LogPrefix.TRANSLATE,
      });
    } catch (error) {
      this._logger?.error(`Failed to initialize TranslateService: ${error}`, {
        prefix: LogPrefix.TRANSLATE,
      });
    }
  }

  /** Returns array that contains all translation keys */
  public static async translationKeys() {
    if (this._translationKeys.length > 0) {
      return this._translationKeys;
    }

    await this._loadTranslationKeys();
    return this._translationKeys;
  }

  private static async _loadTranslationKeys() {
    const translation = await this._loadTranslation("en");

    if (!translation) {
      this._logger?.warn(
        "Failed to load English translation for keys extraction",
        { prefix: LogPrefix.TRANSLATE }
      );
      return;
    }

    const keySet = new Set(this._translationKeys);
    for (const key of Object.keys(translation)) {
      if (!keySet.has(key)) {
        this._translationKeys.push(key);
        keySet.add(key);
      }
    }
  }

  private static async _loadTranslation(
    language: Language
  ): Promise<Translation | null> {
    const existing = this._translationsMap.get(language);
    if (!ValueUtils.isBad(existing) && !ValueUtils.isEmpty(existing)) {
      return existing;
    }

    try {
      const filePath = path.join(this._translationsPath, `${language}.json`);
      await fs.promises.access(filePath, fs.constants.F_OK);

      const translation = JSON.parse(
        await fs.promises.readFile(filePath, "utf8")
      );

      this._translationsMap.set(language, translation);
      this._logger?.info(`Translation loading for '${language}' is completed`, {
        prefix: LogPrefix.TRANSLATE,
      });
      return translation;
    } catch {
      // Ignore if we don't have translation for provided language, will use eng
    }

    return null;
  }

  public static async localize(
    translationKey: string,
    headers?: IncomingHttpHeaders
  ) {
    const lang = this.parseHeaders(headers);
    return this.translate(translationKey, lang);
  }

  /**
   * Translates text with a given language by its translationKey
   * or returns English translation (default).
   * If no value by key is found, the key will be returned.
   */
  public static async translate(
    translationKey: string,
    language?: Language
  ): Promise<string> {
    const selectedLang = language ?? "en";
    const translation =
      (await this._loadTranslation(selectedLang)) ??
      (await this._loadTranslation("en"));

    if (!translation) {
      this._logger?.warn(
        `Translation for language '${selectedLang}' not found. Returning key.`,
        { prefix: LogPrefix.TRANSLATE }
      );
      return translationKey;
    }

    return translation[translationKey] ?? translationKey;
  }

  /**
   * Parse "Accept-Language" header to get the first preferred language.
   */
  public static parseHeaders(headers?: IncomingHttpHeaders): string {
    if (!headers) {
      return "en";
    }
    const langHeader = headers["accept-language"];
    if (!langHeader) {
      return "en";
    }
    // Example: en-US;q=0.6,en;q=0.5
    return langHeader.split(",")[0].split(";")[0].split("-")[0];
  }
}
