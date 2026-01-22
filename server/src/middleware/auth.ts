import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { verifyAppJwt } from "../lib/oidc.js";
import type { AuthUser, Permission, Role } from "../types/auth.js";
import { ROLE_PERMISSIONS } from "../types/auth.js";

// Cookie name for auth token
export const AUTH_COOKIE_NAME = "auth_token";

// Middleware to verify JWT and set user in context
export const authMiddleware = createMiddleware<{
  Variables: { user: AuthUser };
}>(async (c, next) => {
  const token = getCookie(c, AUTH_COOKIE_NAME);

  if (!token) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  try {
    const user = await verifyAppJwt(token);
    c.set("user", user);
    await next();
  } catch {
    throw new HTTPException(401, { message: "Invalid token" });
  }
});

// Optional auth - sets user if token exists, continues otherwise
export const optionalAuthMiddleware = createMiddleware<{
  Variables: { user: AuthUser | null };
}>(async (c, next) => {
  const token = getCookie(c, AUTH_COOKIE_NAME);

  if (token) {
    try {
      const user = await verifyAppJwt(token);
      c.set("user", user);
    } catch {
      c.set("user", null);
    }
  } else {
    c.set("user", null);
  }

  await next();
});

// Middleware factory to require specific roles
export const requireRole = (...roles: Role[]) => {
  return createMiddleware<{
    Variables: { user: AuthUser };
  }>(async (c, next) => {
    const user = c.get("user");

    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    if (!roles.includes(user.role)) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    await next();
  });
};

// Middleware factory to require specific permissions
export const requirePermission = (...permissions: Permission[]) => {
  return createMiddleware<{
    Variables: { user: AuthUser };
  }>(async (c, next) => {
    const user = c.get("user");

    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    const hasPermission = permissions.every((p) => userPermissions.includes(p));

    if (!hasPermission) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    await next();
  });
};
