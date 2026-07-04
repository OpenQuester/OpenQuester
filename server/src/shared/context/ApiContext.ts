import { type ApiContextDTO } from "shared/context/ApiContextDTO";

export class ApiContext {
  private readonly _ctx: ApiContextDTO;

  constructor(ctx: ApiContextDTO) {
    this._ctx = ctx;
  }

  /**
   * Database
   */
  public get db(): ApiContextDTO["db"] {
    return this._ctx.db;
  }

  /**
   * Express application
   */
  public get app(): ApiContextDTO["app"] {
    return this._ctx.app;
  }

  /**
   * HTTP server
   */
  public get httpServer(): ApiContextDTO["httpServer"] {
    return this._ctx.httpServer;
  }

  /**
   * socket.io server
   */
  public get io(): ApiContextDTO["io"] {
    return this._ctx.io;
  }

  /**
   * Project environment
   */
  public get env(): ApiContextDTO["env"] {
    return this._ctx.env;
  }

  /**
   * Logger instance
   */
  public get logger(): ApiContextDTO["logger"] {
    return this._ctx.logger;
  }
}
