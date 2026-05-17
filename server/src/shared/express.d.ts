import "express-session";

import { Session } from "server/src/domain/types/auth/session";
import { type RequestAuthContext } from "shared/context/RequestAuthContext";

declare module "express-session" {
  interface SessionData {
    userId: number;
    isGuest?: boolean;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: RequestAuthContext;
  }
}

declare global {
  namespace Express {
    interface Request {
      session: Session;
      correlationId: string;
    }
  }
}
