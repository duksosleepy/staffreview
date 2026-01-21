import * as jose from "jose";
import type {
  AuthUser,
  OIDCTokenResponse,
  OIDCUserInfo,
  Role,
} from "../types/auth.js";

// OIDC Provider configuration from environment
export const oidcConfig = {
  endpoint: process.env.OIDC_ENDPOINT || "",
  clientId: process.env.OIDC_CLIENT_ID || "",
  clientSecret: process.env.OIDC_CLIENT_SECRET || "",
  redirectUri: process.env.OIDC_REDIRECT_URI || "",
  scope: process.env.OIDC_SCOPE || "openid profile email",
};

// JWT configuration
export const jwtConfig = {
  secret: process.env.JWT_SECRET || "change-this-secret-in-production",
  expiresIn: "7d",
};

// Build authorization URL for OIDC login
export const buildAuthorizationUrl = (state: string): string => {
  const params = new URLSearchParams({
    client_id: oidcConfig.clientId,
    redirect_uri: oidcConfig.redirectUri,
    response_type: "code",
    scope: oidcConfig.scope,
    state,
  });

  return `${oidcConfig.endpoint}/login/oauth/authorize?${params.toString()}`;
};

// Exchange authorization code for tokens
export const exchangeCodeForTokens = async (
  code: string,
): Promise<OIDCTokenResponse> => {
  const response = await fetch(
    `${oidcConfig.endpoint}/api/login/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: oidcConfig.clientId,
        client_secret: oidcConfig.clientSecret,
        code,
        redirect_uri: oidcConfig.redirectUri,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`);
  }

  return response.json();
};

// Extract role from OIDC user info
export const extractRole = (userInfo: OIDCUserInfo): Role => {
  // Check roles array first
  if (userInfo.roles?.length) {
    const role = userInfo.roles[0].toLowerCase();
    if (isValidRole(role)) return role;
  }

  // Check groups array
  if (userInfo.groups?.length) {
    const group = userInfo.groups[0].toLowerCase();
    if (isValidRole(group)) return group;
  }

  // Check tag field (some IDPs use this)
  if (userInfo.tag) {
    const tag = userInfo.tag.toLowerCase();
    if (isValidRole(tag)) return tag;
  }

  // Default to employee
  return "employee";
};

// Validate role string
const isValidRole = (role: string): role is Role => {
  return ["asm", "cht", "employee"].includes(role);
};

// Create app JWT with user info and role
export const createAppJwt = async (user: AuthUser): Promise<string> => {
  const secret = new TextEncoder().encode(jwtConfig.secret);

  return new jose.SignJWT({
    sub: user.sub,
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(jwtConfig.expiresIn)
    .sign(secret);
};

// Verify and decode app JWT
export const verifyAppJwt = async (token: string): Promise<AuthUser> => {
  const secret = new TextEncoder().encode(jwtConfig.secret);
  const { payload } = await jose.jwtVerify(token, secret);

  return {
    sub: payload.sub as string,
    name: payload.name as string,
    email: payload.email as string,
    role: payload.role as Role,
  };
};

// Decode OIDC ID token (without verification - IDP already verified)
export const decodeIdToken = (idToken: string): OIDCUserInfo => {
  const payload = jose.decodeJwt(idToken);

  return {
    sub: payload.sub as string,
    name: (payload.name as string) || "",
    email: (payload.email as string) || "",
    preferred_username: payload.preferred_username as string | undefined,
    groups: payload.groups as string[] | undefined,
    roles: payload.roles as string[] | undefined,
    tag: payload.tag as string | undefined,
  };
};
