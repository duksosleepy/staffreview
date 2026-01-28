import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../lib/env.js";
import {
  buildAuthorizationUrl,
  createAppJwt,
  decodeIdToken,
  exchangeCodeForTokens,
  extractRole,
  fetchCasdoorUserInfo,
} from "../lib/oidc.js";
import { AUTH_COOKIE_NAME, authMiddleware } from "../middleware/auth.js";
import { ROLE_PERMISSIONS } from "../types/auth.js";

// State cookie for CSRF protection
const STATE_COOKIE_NAME = "oauth_state";

export const authRoutes = new Hono<Env>()
  // Redirect to IDP login
  .get("/login", (c) => {
    const state = crypto.randomUUID();

    // Store state in cookie for verification
    setCookie(c, STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 10, // 10 minutes
    });

    const authUrl = buildAuthorizationUrl(state);
    return c.redirect(authUrl);
  })

  // Handle IDP callback
  .get("/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const storedState = getCookie(c, STATE_COOKIE_NAME);

    // Verify state to prevent CSRF
    if (!state || state !== storedState) {
      throw new HTTPException(400, { message: "Invalid state parameter" });
    }

    if (!code) {
      throw new HTTPException(400, { message: "Missing authorization code" });
    }

    // Clear state cookie
    deleteCookie(c, STATE_COOKIE_NAME);

    try {
      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(code);

      // Decode ID token to get user info
      const userInfo = decodeIdToken(tokens.id_token);
      const role = extractRole(userInfo);

      // Fetch full Casdoor user object to get properties (CUAHANG, ID)
      const { stores, casdoor_id } = await fetchCasdoorUserInfo(tokens.access_token);

      // Create app JWT with user info, role, stores, and casdoor_id
      const appJwt = await createAppJwt({
        sub: userInfo.sub,
        name: userInfo.name,
        displayName: userInfo.displayName || userInfo.name,
        email: userInfo.email,
        role,
        stores,
        casdoor_id,
      });

      // Set auth cookie
      setCookie(c, AUTH_COOKIE_NAME, appJwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      // Redirect to frontend
      const frontendUrl = process.env.FRONTEND_URL || "/";
      return c.redirect(frontendUrl);
    } catch (error) {
      const errLog = c.get("log");
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      errLog?.error({ errorMessage, errorStack }, "Auth callback failed");
      throw new HTTPException(500, { message: `Authentication failed: ${errorMessage}` });
    }
  })

  // Get current user info
  .get("/me", authMiddleware, (c) => {
    const user = c.get("user");
    const permissions = ROLE_PERMISSIONS[user.role] || [];

    return c.json({
      user: {
        sub: user.sub,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions,
        stores: user.stores,
        casdoor_id: user.casdoor_id,
      },
    });
  })

  // Logout
  .post("/logout", (c) => {
    deleteCookie(c, AUTH_COOKIE_NAME, { path: "/" });
    return c.json({ success: true });
  })

  // Check if authenticated (for frontend)
  .get("/check", (c) => {
    const token = getCookie(c, AUTH_COOKIE_NAME);
    return c.json({ authenticated: !!token });
  });
