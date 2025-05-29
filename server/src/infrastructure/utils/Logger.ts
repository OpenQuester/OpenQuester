import fs from "fs";
import path from "path";

import {
  blueBright,
  bold,
  cyanBright,
  gray as grayCol,
  green,
  magenta,
  red,
  yellow,
} from "colorette";
import { LogLevel } from "domain/types/log/log";
import { Environment } from "infrastructure/config/Environment";

/**
 * Logger class used for writing logs and for prettier console output
 */
export class Logger {
  private static logPath = path.resolve(process.cwd(), "logs/logs.log");
  private static stream = fs.createWriteStream(Logger.logPath, { flags: "a" });
  private static initialized = false;
  private static logPathExists = false;

  private static ensureStream() {
    if (this.initialized) return;
    this.initialized = true;
    this.stream.on("error", (err) => {
      console.error("[LOGGER STREAM ERROR]", err);
    });
  }

  // Ignore rule since this is called only once at server start/first migration
  /* eslint-disable node/no-sync */
  private static ensureFilePath() {
    if (this.logPathExists) return;

    if (!fs.existsSync(this.logPath)) {
      fs.mkdirSync("logs/", { recursive: true });
      fs.writeFileSync(this.logPath, "");
    }
    this.logPathExists = true;
  }
  /* eslint-enable node/no-sync */

  public static checkAccess(logLevel: LogLevel, requiredLogLevel: LogLevel) {
    const levels = ["info", "debug", "verbose"];
    const logIndex = levels.indexOf(logLevel);
    const requiredLogIndex = levels.indexOf(requiredLogLevel);

    if (logIndex === -1 || logIndex < requiredLogIndex) {
      return false;
    }

    return true;
  }

  public static info(text: unknown, prefix?: string) {
    return this._log(green, (prefix ?? "[INFO]: ") + String(text));
  }

  public static warn(text: unknown, prefix?: string) {
    return this._log(yellow, (prefix ?? "[WARNING]: ") + String(text));
  }

  public static error(text: unknown, prefix?: string) {
    return this._log(red, bold((prefix ?? "[ERROR]: ") + String(text)));
  }

  public static pink(text: unknown, prefix?: string) {
    return this._log(magenta, (prefix ?? "") + String(text));
  }

  public static gray(text: unknown, prefix?: string) {
    return this._log(grayCol, (prefix ?? "") + String(text));
  }

  public static debug(obj: unknown) {
    const logLevel = Environment.instance.LOG_LEVEL || process.env.LOG_LEVEL;
    const env = Environment.instance.ENV || process.env.ENV;

    if (logLevel !== "debug" || env === "test") {
      return;
    }

    const prefix = "[DEBUG]: ";
    let text = "";

    if (obj instanceof Map) {
      obj = Object.fromEntries(obj);
    }

    // Parse object to show it fully
    if (typeof obj === "object") {
      const seen = new Set();
      text = JSON.stringify(
        obj,
        (_, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
              // Replace circular references with a placeholder
              return `[Circular]`;
            }
            seen.add(value);
          }
          return value;
        },
        2
      );
    } else {
      text = String(obj);
    }

    const log = cyanBright(prefix + text);

    console.debug(log);

    this._writeFile(log);
  }

  public static logMigrationComplete(version: string) {
    const prefix = "[Migration]";

    const log = `${prefix} Migration complete for version ${version}`;

    console.log(blueBright(log));

    this._writeFile(log);
  }

  private static _log(color: any, text: string) {
    this.ensureStream();
    this.ensureFilePath();

    const log = `[${new Date().toISOString()}] ${text}`;
    console.log(color(log));
    this._writeFile(log);
  }

  private static _writeFile(text: unknown) {
    if (Environment.instance.ENV === "test") {
      // Skip writing to file in test environment
      return;
    }

    if (!Logger.stream.write(text + "\n")) {
      Logger.stream.once("drain", () => {
        /* nothing else to do */
      });
    }
  }
}
