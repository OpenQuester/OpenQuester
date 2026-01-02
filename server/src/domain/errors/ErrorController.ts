import { IncomingHttpHeaders } from "http";

import { TranslateService as ts } from "application/services/text/TranslateService";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ServerResponse } from "domain/enums/ServerResponse";
import { BaseError } from "domain/errors/BaseError";
import { ClientError } from "domain/errors/ClientError";
import { ServerError } from "domain/errors/ServerError";
import { Language } from "domain/types/text/translation";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { TemplateUtils } from "infrastructure/utils/TemplateUtils";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class ErrorController {
  /**
   * Resolves error and returns its message and code
   *
   * Note: This is the single point where server errors are logged (Rule 6)
   */
  public static async resolveError(
    error: unknown,
    logger: ILogger,
    headers?: IncomingHttpHeaders,
    contextMeta?: Record<string, unknown>
  ): Promise<{
    message: string;
    code: number;
  }> {
    error = await this._formatError(error, ts.parseHeaders(headers));

    if (error instanceof SyntaxError) {
      return {
        message: error.message,
        code: HttpStatus.BAD_REQUEST,
      };
    }

    if (!(error instanceof BaseError)) {
      let message: string = "";

      if (error instanceof Error) {
        message += error.message;
        message += error.stack ? `\nStack: ${error.stack}` : "";
      }

      error = new ServerError(message);
    }

    // Server errors: unexpected failures that break responsibility
    if (error instanceof ServerError) {
      logger.error(`Server error occurred`, {
        prefix: LogPrefix.ERROR,
        error: error.message,
        stack: error.stack,
        ...(contextMeta ?? {}),
      });
      return {
        message: ServerResponse.INTERNAL_SERVER_ERROR,
        code: HttpStatus.INTERNAL,
      };
    }

    // Client errors: expected failures, no logging needed
    if (error instanceof ClientError) {
      return {
        message: error.message,
        code: error.code,
      };
    }

    // Unknown error type - treat as server error
    logger.error(`Unknown error type encountered`, {
      prefix: LogPrefix.ERROR,
      error: JSON.stringify(error),
      ...(contextMeta ?? {}),
    });
    return {
      message: ServerResponse.INTERNAL_SERVER_ERROR,
      code: HttpStatus.INTERNAL,
    };
  }

  private static async _formatError<T>(error: T, lang?: Language): Promise<T> {
    if (!(error instanceof BaseError)) {
      return error;
    }
    const args = error.textArgs;

    const translatedMessage = await ts.translate(error.message, lang);
    let message = translatedMessage;

    if (args && ValueUtils.isObject(args) && !ValueUtils.isEmpty(args)) {
      message = TemplateUtils.text(message, args);
    }

    error.message = message;
    return error;
  }
}
