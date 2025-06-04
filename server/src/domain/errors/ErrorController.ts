import { IncomingHttpHeaders } from "http";

import { TranslateService as ts } from "application/services/text/TranslateService";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ServerResponse } from "domain/enums/ServerResponse";
import { BaseError } from "domain/errors/BaseError";
import { ClientError } from "domain/errors/ClientError";
import { ServerError } from "domain/errors/ServerError";
import { Language } from "domain/types/text/translation";
import { Logger } from "infrastructure/utils/Logger";
import { TemplateUtils } from "infrastructure/utils/TemplateUtils";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class ErrorController {
  /**
   * Resolves error and returns it message and code
   */
  public static async resolveError(
    error: unknown,
    headers?: IncomingHttpHeaders
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
      }

      error = new ServerError(message);
    }

    if (error instanceof ServerError) {
      Logger.error(`Internal server error: ${error.message} \n${error.stack}`);
      return {
        message: ServerResponse.INTERNAL_SERVER_ERROR,
        code: HttpStatus.INTERNAL,
      };
    }

    if (error instanceof ClientError) {
      return {
        message: error.message,
        code: error.code,
      };
    }

    Logger.error(`Error of unknown type caught: ${JSON.stringify(error)}`);
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
