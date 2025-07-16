import { type Express } from "express";
import { type Server as IOServer } from "socket.io";

import { type Environment } from "infrastructure/config/Environment";
import { type Database } from "infrastructure/database/Database";
import { ILogger } from "infrastructure/logger/ILogger";

export interface ApiContextDTO {
  db: Database;
  app: Express;
  io: IOServer;
  env: Environment;
  logger: ILogger;
}
