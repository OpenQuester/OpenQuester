import { ApiContextDTO } from "domain/types/context/ApiContextDTO";

export class ApiContext {
  private readonly _ctx: ApiContextDTO;

  constructor(ctx: ApiContextDTO) {
    this._ctx = ctx;
  }

  /**
   * Database
   */
  public get db() {
    return this._ctx.db;
  }

  /**
   * Express application
   */
  public get app() {
    return this._ctx.app;
  }

  /**
   * socket.io server
   */
  public get io() {
    return this._ctx.io;
  }

  /**
   * Project environment
   */
  public get env() {
    return this._ctx.env;
  }

  /**
   * Logger instance
   */
  public get logger() {
    return this._ctx.logger;
  }
}
