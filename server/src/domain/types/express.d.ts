import "express-session";

import { Session } from "domain/types/auth/session";
import { type User } from "infrastructure/database/models/User";

declare module "express-session" {
  interface SessionData {
    userId: number;
    isGuest?: boolean;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

declare global {
  namespace Express {
    interface Request {
      session: Session;
    }
  }
}
