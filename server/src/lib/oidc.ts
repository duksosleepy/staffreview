import * as jose from 'jose';
import type { AuthUser, OIDCTokenResponse, OIDCUserInfo, Role } from '../types/auth.js';

// OIDC Provider configuration from environment
export const oidcConfig = {
  endpoint: process.env.OIDC_ENDPOINT || '',
  clientId: process.env.OIDC_CLIENT_ID || '',
  clientSecret: process.env.OIDC_CLIENT_SECRET || '',
  redirectUri: process.env.OIDC_REDIRECT_URI || '',
  scope: process.env.OIDC_SCOPE || 'openid profile email',
};

// JWT configuration
export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'change-this-secret-in-production',
  expiresIn: '7d',
};

// Build authorization URL for OIDC login
export const buildAuthorizationUrl = (state: string): string => {
  const params = new URLSearchParams({
    client_id: oidcConfig.clientId,
    redirect_uri: oidcConfig.redirectUri,
    response_type: 'code',
    scope: oidcConfig.scope,
    state,
  });

  return `${oidcConfig.endpoint}/login/oauth/authorize?${params.toString()}`;
};

// Exchange authorization code for tokens
export const exchangeCodeForTokens = async (code: string): Promise<OIDCTokenResponse> => {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: oidcConfig.clientId,
    client_secret: oidcConfig.clientSecret,
    code,
    redirect_uri: oidcConfig.redirectUri,
  });

  const response = await fetch(`${oidcConfig.endpoint}/api/login/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await response.json();

  // Casdoor returns error in JSON body, not HTTP status
  if (data.error) {
    throw new Error(`Token exchange failed: ${data.error_description || data.error}`);
  }

  return data;
};

// Helper to extract string value from role/group (handles both string and object formats)
const extractRoleString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value.toLowerCase();
  }
  // Casdoor returns roles as objects like { name: "admin" }
  if (value && typeof value === 'object' && 'name' in value) {
    const name = (value as { name: unknown }).name;
    if (typeof name === 'string') {
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
  return 'employee';
};

// Extract role from Casdoor user object (for user listing)
// Similar to extractRole but works with user objects from /api/get-users
const extractRoleFromUser = (user: any): Role => {
  // Check roles array first (same structure as OIDC token)
  if (user.roles?.length) {
    const role = extractRoleString(user.roles[0]);
    if (role && isValidRole(role)) return role;
  }

  // Check tag field
  if (user.tag) {
    const role = normalizeRole(user.tag);
    if (role) return role;
  }

  // Check signupApplication field (Casdoor sometimes stores role here)
  if (user.signupApplication) {
    const role = normalizeRole(user.signupApplication);
    if (role) return role;
  }

  // Default to employee
  return 'employee';
};

// Map Casdoor tag display names to internal role codes
const TAG_TO_ROLE: Record<string, Role> = {
  'area manager': 'asm',
  asm: 'asm',
  cht: 'cht',
  employee: 'employee',
};

// Normalize a tag/role string to an internal Role, or return null
const normalizeRole = (value: string): Role | null => {
  return TAG_TO_ROLE[value.toLowerCase()] ?? null;
};

// Validate role string
const isValidRole = (role: string): role is Role => {
  return ['asm', 'cht', 'employee'].includes(role);
};

// Create app JWT with user info and role
export const createAppJwt = async (user: AuthUser): Promise<string> => {
  const secret = new TextEncoder().encode(jwtConfig.secret);

  return new jose.SignJWT({
    sub: user.sub,
    name: user.name,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    stores: user.stores,
    casdoor_id: user.casdoor_id,
  })
    .setProtectedHeader({ alg: 'HS256' })
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
    displayName: (payload.displayName as string) || (payload.name as string),
    email: payload.email as string,
    role: payload.role as Role,
    stores: (payload.stores as string[]) ?? [],
    casdoor_id: (payload.casdoor_id as string) ?? '',
  };
};

// Fetch full Casdoor user object via API (includes properties like CUAHANG, ID)
export const fetchCasdoorUserInfo = async (accessToken: string): Promise<{ stores: string[]; casdoor_id: string }> => {
  const response = await fetch(`${oidcConfig.endpoint}/api/get-account`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();

  // Casdoor wraps user object inside data.data
  const userData = data?.data ?? {};
  const properties = userData.properties ?? {};
  const cuahang = properties.CUAHANG ?? '';
  const casdoorId = properties.ID ?? '';

  // CUAHANG is comma-separated store IDs, e.g. "S001,S002"
  const stores = cuahang
    ? cuahang
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
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

// Fetch role assignments from Casdoor's /api/get-roles endpoint.
// Returns user role map and group role map for resolving roles through group membership.
const fetchCasdoorRoleMapping = async (): Promise<{
  userRoleMap: Map<string, Role>;
  groupRoleMap: Map<string, Role>;
}> => {
  const owner = process.env.CASDOOR_ORG || 'lug.vn';
  const params = new URLSearchParams({
    owner,
    clientId: oidcConfig.clientId,
    clientSecret: oidcConfig.clientSecret,
  });

  const response = await fetch(`${oidcConfig.endpoint}/api/get-roles?${params.toString()}`);

  if (!response.ok) {
    console.error(`Casdoor get-roles failed: ${response.status}`);
    return { userRoleMap: new Map(), groupRoleMap: new Map() };
  }

  const rawBody = await response.json();

  // Casdoor may wrap in { data: [...] } or return array directly
  const roles = Array.isArray(rawBody) ? rawBody : (rawBody?.data ?? rawBody);

  if (!Array.isArray(roles)) {
    return { userRoleMap: new Map(), groupRoleMap: new Map() };
  }

  const userRoleMap = new Map<string, Role>();
  const groupRoleMap = new Map<string, Role>();

  for (const role of roles) {
    const roleName = (role.name as string)?.toLowerCase();
    if (!roleName || !isValidRole(roleName)) continue;

    // Map users directly assigned to this role
    const users: string[] = role.users ?? [];
    for (const userId of users) {
      userRoleMap.set(userId, roleName as Role);
    }

    // Map groups assigned to this role (e.g., "LUG.vn/ASM" → "asm")
    const groups: string[] = role.groups ?? [];
    for (const groupId of groups) {
      groupRoleMap.set(groupId, roleName as Role);
    }
  }

  return { userRoleMap, groupRoleMap };
};

// Fetch all users from Casdoor org, filtered by store IDs and requester role.
// Resolves roles via Casdoor's /api/get-roles (each role lists its assigned users).
// CHT: can only see employees and other CHTs (no ASMs)
// ASM: can see all users in their stores
export const fetchCasdoorUsersByStores = async (
  storeIds: string[],
  requesterRole: Role = 'employee',
): Promise<CasdoorEmployee[]> => {
  const owner = process.env.CASDOOR_ORG || 'lug.vn';
  const params = new URLSearchParams({
    owner,
    clientId: oidcConfig.clientId,
    clientSecret: oidcConfig.clientSecret,
  });

  // Fetch users and role assignments in parallel
  const [usersResponse, roleMaps] = await Promise.all([
    fetch(`${oidcConfig.endpoint}/api/get-users?${params.toString()}`),
    fetchCasdoorRoleMapping(),
  ]);

  const { userRoleMap, groupRoleMap } = roleMaps;

  if (!usersResponse.ok) {
    throw new Error(`Casdoor get-users failed: ${usersResponse.status}`);
  }

  const rawBody = await usersResponse.json();

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
    const cuahang = properties.CUAHANG ?? '';
    const userStores = cuahang
      ? cuahang
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

    // Check if any of the user's stores match
    const hasMatchingStore = userStores.some((s: string) => storeSet.has(s));
    if (!hasMatchingStore) continue;

    // Resolve role from Casdoor role assignments (userId format: "org/username")
    const userId = `${owner}/${user.name}`;
    let role: Role = userRoleMap.get(userId) ?? 'employee';

    // FALLBACK: Check if user belongs to any groups that have roles assigned
    if (role === 'employee' && user.groups?.length) {
      for (const groupId of user.groups) {
        const groupRole = groupRoleMap.get(groupId);
        if (groupRole && groupRole !== 'employee') {
          role = groupRole;
          console.log(`[Role via Group] User ${userId} assigned role "${role}" via group "${groupId}"`);
          break; // Use first non-employee role found
        }
      }
    }

    // RBAC: CHT can only see employees and other CHTs, not ASMs
    // Normalize role strings to lowercase for case-insensitive comparison
    const normalizedRequesterRole = (requesterRole || 'employee').toLowerCase().trim();
    const normalizedUserRole = (role || 'employee').toLowerCase().trim();

    if (normalizedRequesterRole === 'cht' && normalizedUserRole === 'asm') {
      continue;
    }

    employees.push({
      id: user.id,
      name: user.name,
      displayName: user.displayName || user.name,
      email: user.email || '',
      stores: userStores,
      casdoor_id: properties.ID ?? '',
      role,
    });
  }

  return employees;
};

// Fetch a single Casdoor user by their Casdoor user ID to get their hr_id (properties.ID)
export const fetchCasdoorUserById = async (
  userId: string
): Promise<{ casdoor_id: string } | null> => {
  const owner = process.env.CASDOOR_ORG || 'lug.vn';
  const params = new URLSearchParams({
    owner,
    clientId: oidcConfig.clientId,
    clientSecret: oidcConfig.clientSecret,
  });

  try {
    // Get all users and find by ID (Casdoor doesn't have a direct get-by-id endpoint)
    const response = await fetch(`${oidcConfig.endpoint}/api/get-users?${params.toString()}`);

    if (!response.ok) {
      return null;
    }

    const rawBody = await response.json();
    const users = Array.isArray(rawBody) ? rawBody : (rawBody?.data ?? rawBody);

    if (!Array.isArray(users)) {
      return null;
    }

    // Find user by ID
    const user = users.find((u: any) => u.id === userId);
    if (!user) {
      return null;
    }

    const properties = user.properties ?? {};
    const casdoorId = properties.ID ?? '';

    return { casdoor_id: casdoorId };
  } catch (error) {
    console.error('Failed to fetch Casdoor user by ID:', error);
    return null;
  }
};

// Decode OIDC ID token (without verification - IDP already verified)
export const decodeIdToken = (idToken: string): OIDCUserInfo => {
  const payload = jose.decodeJwt(idToken);

  return {
    sub: payload.sub as string,
    name: (payload.name as string) || '',
    displayName: (payload.displayName as string) || (payload.name as string),
    email: (payload.email as string) || '',
    preferred_username: payload.preferred_username as string | undefined,
    groups: payload.groups as string[] | undefined,
    roles: payload.roles as string[] | undefined,
    tag: payload.tag as string | undefined,
  };
};
