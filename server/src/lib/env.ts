import type { Client } from "gel";
import type pino from "pino";
import type { AuthUser } from "../types/auth.js";

// Typed environment for Hono context
export type Env = {
  Variables: {
    db: Client;
    log: pino.Logger;
    user?: AuthUser;
  };
};
