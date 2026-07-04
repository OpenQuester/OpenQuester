import { type Express } from "express";
import { type Server as HTTPServer } from "http";
import { type Server as IOServer } from "socket.io";

import { type Environment } from "shared/config/Environment";
import { type Database } from "infrastructure/database/Database";
import { type ILogger } from "shared/logging/ILogger";

export interface ApiContextDTO {
  db: Database;
  app: Express;
  httpServer: HTTPServer;
  io: IOServer;
  env: Environment;
  logger: ILogger;
}
