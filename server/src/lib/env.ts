import type { Client } from "gel";
import type pino from "pino";

// Typed environment for Hono context
export type Env = {
  Variables: {
    db: Client;
    log: pino.Logger;
  };
};
