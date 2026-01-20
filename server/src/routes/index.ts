import { Hono } from "hono";
import type { Env } from "../lib/env.js";
import { healthRoutes } from "./health.js";
import { queryRoutes } from "./query.js";

// Compose all API routes
export const apiRoutes = new Hono<Env>()
  .route("/query", queryRoutes)
  .route("/health", healthRoutes);
