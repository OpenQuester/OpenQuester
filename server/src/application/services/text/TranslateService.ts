import fs from "fs";
import { IncomingHttpHeaders } from "http";
import path from "path";

import { Language, Translation } from "domain/types/text/translation";
import { Logger } from "infrastructure/utils/Logger";
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

  public static async initialize(): Promise<void> {
    try {
      await this._loadTranslation("en");
      await this._loadTranslationKeys();
      Logger.gray("TranslateService initialized successfully");
    } catch (error) {
      Logger.error(`Failed to initialize TranslateService: ${error}`);
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
      Logger.warn("Failed to load English translation for keys extraction");
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
      Logger.gray(`Translation loading for '${language}' is completed`);
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
      Logger.warn(
        `Translation for language '${selectedLang}' not found. Returning key.`
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
