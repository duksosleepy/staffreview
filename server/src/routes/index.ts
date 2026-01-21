import { Hono } from "hono";
import type { Env } from "../lib/env.js";
import { healthRoutes } from "./health.js";
import { checklistRoutes } from "./checklist.js";

// Compose all API routes
// NOTE: Raw /query endpoint removed for security - use specific endpoints instead
export const apiRoutes = new Hono<Env>()
  .route("/checklist", checklistRoutes)
  .route("/health", healthRoutes);
