import "express-session";

import { Session } from "domain/types/auth/session";
import { type RequestAuthContext } from "shared/context/RequestAuthContext";

declare module "express-session" {
  interface SessionData {
    userId: number;
    isGuest?: boolean;
    /** Signed in inside the Discord Activity iframe: keep its host-only cookie */
    discordActivity?: boolean;
  }

  // express-session 1.18 sends `Partitioned`, but its Cookie type lacks the field
  interface Cookie {
    partitioned?: boolean;
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
