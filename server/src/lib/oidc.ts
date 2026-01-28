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
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: oidcConfig.clientId,
    client_secret: oidcConfig.clientSecret,
    code,
    redirect_uri: oidcConfig.redirectUri,
  });

  const response = await fetch(
    `${oidcConfig.endpoint}/api/login/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
  );

  const data = await response.json();

  // Casdoor returns error in JSON body, not HTTP status
  if (data.error) {
    throw new Error(`Token exchange failed: ${data.error_description || data.error}`);
  }

  return data;
};

// Helper to extract string value from role/group (handles both string and object formats)
const extractRoleString = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value.toLowerCase();
  }
  // Casdoor returns roles as objects like { name: "admin" }
  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name: unknown }).name;
    if (typeof name === "string") {
      return name.toLowerCase();
    }
  }
  return null;
};

// Extract role from OIDC user info
export const extractRole = (userInfo: OIDCUserInfo): Role => {
  // Check roles array first
  if (userInfo.roles?.length) {
    const role = extractRoleString(userInfo.roles[0]);
    if (role && isValidRole(role)) return role;
  }

  // Check groups array
  if (userInfo.groups?.length) {
    const group = extractRoleString(userInfo.groups[0]);
    if (group && isValidRole(group)) return group;
  }

  // Check tag field (some IDPs use this) — map display names to role codes
  if (userInfo.tag) {
    const role = normalizeRole(userInfo.tag);
    if (role) return role;
  }

  // Default to employee
  return "employee";
};

// Map Casdoor tag display names to internal role codes
const TAG_TO_ROLE: Record<string, Role> = {
  "area manager": "asm",
  "asm": "asm",
  "cht": "cht",
  "employee": "employee",
};

// Normalize a tag/role string to an internal Role, or return null
const normalizeRole = (value: string): Role | null => {
  return TAG_TO_ROLE[value.toLowerCase()] ?? null;
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
    stores: user.stores,
    casdoor_id: user.casdoor_id,
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
    stores: (payload.stores as string[]) ?? [],
    casdoor_id: (payload.casdoor_id as string) ?? "",
  };
};

// Fetch full Casdoor user object via API (includes properties like CUAHANG, ID)
export const fetchCasdoorUserInfo = async (
  accessToken: string,
): Promise<{ stores: string[]; casdoor_id: string }> => {
  const response = await fetch(
    `${oidcConfig.endpoint}/api/get-account`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  const data = await response.json();

  // Casdoor wraps user object inside data.data
  const userData = data?.data ?? {};
  const properties = userData.properties ?? {};
  const cuahang = properties.CUAHANG ?? "";
  const casdoorId = properties.ID ?? "";

  // CUAHANG is comma-separated store IDs, e.g. "S001,S002"
  const stores = cuahang
    ? cuahang.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

  return { stores, casdoor_id: casdoorId };
};

// Casdoor user type for employee listing
export type CasdoorEmployee = {
  id: string;
  name: string;
  displayName: string;
  email: string;
  stores: string[];
  casdoor_id: string;
  role: string;
};

// Fetch all users from Casdoor org, filtered by store IDs
export const fetchCasdoorUsersByStores = async (
  storeIds: string[],
): Promise<CasdoorEmployee[]> => {
  // Casdoor API: GET /api/get-users?owner={org}&clientId={id}&clientSecret={secret}
  const owner = process.env.CASDOOR_ORG || "lug.vn";
  const params = new URLSearchParams({
    owner,
    clientId: oidcConfig.clientId,
    clientSecret: oidcConfig.clientSecret,
  });

  const response = await fetch(
    `${oidcConfig.endpoint}/api/get-users?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Casdoor get-users failed: ${response.status}`);
  }

  const rawBody = await response.json();

  // Casdoor may return array directly or wrapped in { data: [...] }
  const users = Array.isArray(rawBody) ? rawBody : (rawBody?.data ?? rawBody);

  if (!Array.isArray(users)) {
    return [];
  }

  // Filter users whose CUAHANG property overlaps with requested storeIds
  const storeSet = new Set(storeIds);
  const employees: CasdoorEmployee[] = [];

  for (const user of users) {
    const properties = user.properties ?? {};
    const cuahang = properties.CUAHANG ?? "";
    const userStores = cuahang
      ? cuahang.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];

    // Check if any of the user's stores match
    const hasMatchingStore = userStores.some((s: string) => storeSet.has(s));
    if (!hasMatchingStore) continue;

    // Extract role: check roles array first, then tag field as fallback
    let role: Role = "employee";
    if (user.roles?.length) {
      const r = extractRoleString(user.roles[0]);
      if (r && isValidRole(r)) role = r;
    } else if (user.tag) {
      const mapped = normalizeRole(user.tag);
      if (mapped) role = mapped;
    }

    employees.push({
      id: user.id,
      name: user.name,
      displayName: user.displayName || user.name,
      email: user.email || "",
      stores: userStores,
      casdoor_id: properties.ID ?? "",
      role,
    });
  }

  return employees;
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
