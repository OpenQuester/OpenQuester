import { type Logger as TypeOrmLogger, type QueryRunner } from "typeorm";

import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

/**
 * Routes TypeORM logs through the application logger.
 */
export class TypeOrmLoggerAdapter implements TypeOrmLogger {
  constructor(private readonly logger: ILogger) {
    //
  }

  public logQuery(query: string, parameters?: unknown[], _queryRunner?: QueryRunner): void {
    this.logger.debug("TypeORM query executed", {
      prefix: LogPrefix.DB,
      query,
      parameters: parameters ?? []
    });
  }

  public logQueryError(
    error: string | Error,
    query: string,
    parameters?: unknown[],
    _queryRunner?: QueryRunner
  ): void {
    this.logger.error("TypeORM query failed", {
      prefix: LogPrefix.DB,
      error: error instanceof Error ? error.message : String(error),
      query,
      parameters: parameters ?? []
    });
  }

  public logQuerySlow(
    time: number,
    query: string,
    parameters?: unknown[],
    _queryRunner?: QueryRunner
  ): void {
    this.logger.warn("TypeORM slow query", {
      prefix: LogPrefix.DB,
      durationMs: time,
      query,
      parameters: parameters ?? []
    });
  }

  public logSchemaBuild(message: string, _queryRunner?: QueryRunner): void {
    this.logger.info("TypeORM schema build", {
      prefix: LogPrefix.DB,
      message
    });
  }

  public logMigration(message: string, _queryRunner?: QueryRunner): void {
    this.logger.migration(message, {
      prefix: LogPrefix.MIGRATION
    });
  }

  public log(level: "log" | "info" | "warn", message: unknown, _queryRunner?: QueryRunner): void {
    const meta = {
      prefix: LogPrefix.DB,
      message: String(message)
    };

    if (level === "warn") {
      this.logger.warn("TypeORM warning", meta);
      return;
    }

    this.logger.info("TypeORM log", meta);
  }
}
