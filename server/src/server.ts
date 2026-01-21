import "dotenv/config";
import { serve } from "@hono/node-server";
import { createClient } from "gel";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createFactory } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import pino from "pino";
import { ZodError } from "zod";
import type { Env } from "./lib/env.js";
import { apiRoutes } from "./routes/index.js";
import { authRoutes } from "./routes/auth.js";

// Environment configuration
const port = Number.parseInt(process.env.PORT || "3001", 10);
const isDev = process.env.NODE_ENV !== "production";

// Logger setup
const log = pino({
  level: isDev ? "debug" : "info",
  transport: isDev ? { target: "pino-pretty" } : undefined,
});

// Factory for typed middleware
const factory = createFactory<Env>();

// Database client (singleton)
const client = createClient();

// Middleware to inject dependencies
const injectDependencies = factory.createMiddleware(async (c, next) => {
  c.set("db", client);
  c.set("log", log);
  await next();
});

// Create app with middleware and mount routes
const app = new Hono<Env>()
  // Security headers
  .use("*", secureHeaders())
  // Global middleware
  .use("*", logger())
  .use(
    "*",
    cors({
      origin: process.env.ALLOWED_ORIGINS?.split(",") || [],
      credentials: true,
    }),
  )
  .use("*", injectDependencies)
  // Root route
  .get("/", (c) => {
    return c.text("Staff Review API Server");
  })
  // Mount API routes
  .route("/api", apiRoutes)
  // Mount auth routes
  .route("/auth", authRoutes);

// Centralized error handler
app.onError((err, c) => {
  const reqLog = c.get("log") ?? log;

  if (err instanceof HTTPException) {
    reqLog.warn({ status: err.status, message: err.message }, "HTTP exception");
    return c.json({ error: err.message }, err.status);
  }

  if (err instanceof ZodError) {
    const issues = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    reqLog.warn({ issues }, "Validation error");
    return c.json({ error: "Validation failed", issues }, 400);
  }

  reqLog.error({ err }, "Unhandled error");
  return c.json({ error: "Internal Server Error" }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Export type for RPC client usage
export type AppType = typeof app;

// Start server
serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    log.info(
      { port: info.port, env: isDev ? "development" : process.env.NODE_ENV },
      "Server started",
    );
  },
);
