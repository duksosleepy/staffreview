import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../lib/env.js";
import { convertVariables } from "../lib/utils.js";

// Request validation schema
const QueryRequestSchema = z.object({
  query: z.string().min(1, "Query is required"),
  variables: z.record(z.string(), z.unknown()).optional(),
});

// Query routes - chained for type inference
export const queryRoutes = new Hono<Env>().post(
  "/",
  zValidator("json", QueryRequestSchema),
  async (c) => {
    const { query, variables } = c.req.valid("json");
    const db = c.get("db");

    const convertedVariables = convertVariables(variables);
    const result = convertedVariables
      ? await db.query(query, convertedVariables)
      : await db.query(query);

    return c.json(result);
  },
);
