import "express-session";

import { Session } from "domain/types/auth/session";
import { type RequestAuthContext } from "shared/context/RequestAuthContext";

declare module "express-session" {
  interface SessionData {
    userId: number;
    isGuest?: boolean;
    oauthState?: string;
    oauthReturnTo?: string;
    oauthStateExpiresAt?: number;
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
