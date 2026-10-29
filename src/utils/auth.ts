import type { UserRole } from '../config/roles';
import type { Permission } from '../config/permissions';
import { getDefaultPath } from '../config/permissions';
import type { UserStatus } from '../types/user';
import { normalizeRole, normalizeRoles } from '../config/roles';

const AUTH_KEY = 'stenotipisi-auth';
const TOKEN_KEY = 'stenotipisi-token';
const REMEMBER_EMAIL_KEY = 'stenotipisi-remember-email';
const REMEMBER_ENABLED_KEY = 'stenotipisi-remember-enabled';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthErrorCode =
  | 'emailRequired'
  | 'emailInvalid'
  | 'passwordRequired'
  | 'invalidCredentials'
  | 'accountInactive'
  | 'invalidMfaCode';

export class AuthError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  roles: UserRole[];
  role: UserRole;
  permissions?: readonly Permission[];
  status?: UserStatus;
  customerId?: string | null;
  customerName?: string | null;
  mustChangePassword?: boolean;
}

interface LoginResponse {
  requiresMfa: true;
  mfaToken: string;
  email: string;
}

interface VerifyMfaResponse {
  user: AuthUser;
  token: string;
}

export interface MfaChallenge {
  mfaToken: string;
  email: string;
}

export function isAuthenticated(): boolean {
  return localStorage.getItem(AUTH_KEY) !== null;
}

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as AuthUser;
    const roles = normalizeRoles(user.roles ?? user.role);
    return {
      ...user,
      roles,
      role: roles[0] ?? normalizeRole(user.role),
    };
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function updateStoredUser(user: AuthUser): void {
  const roles = normalizeRoles(user.roles ?? user.role);
  localStorage.setItem(
    AUTH_KEY,
    JSON.stringify({
      ...user,
      roles,
      role: roles[0] ?? normalizeRole(user.role),
    }),
  );
}

function storeSession(user: AuthUser, token: string): AuthUser {
  const roles = normalizeRoles(user.roles ?? user.role);
  const normalized = {
    ...user,
    roles,
    role: roles[0] ?? normalizeRole(user.role),
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(normalized));
  localStorage.setItem(TOKEN_KEY, token);
  return normalized;
}

export function getRememberedEmail(): string | null {
  if (localStorage.getItem(REMEMBER_ENABLED_KEY) !== 'true') {
    return null;
  }
  return localStorage.getItem(REMEMBER_EMAIL_KEY);
}

export function persistRememberMe(email: string, remember: boolean): void {
  if (remember) {
    localStorage.setItem(REMEMBER_ENABLED_KEY, 'true');
    localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
  } else {
    localStorage.removeItem(REMEMBER_ENABLED_KEY);
    localStorage.removeItem(REMEMBER_EMAIL_KEY);
  }
}

export function validateLoginCredentials(
  email: string,
  password: string,
): AuthErrorCode | null {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) return 'emailRequired';
  if (!EMAIL_PATTERN.test(trimmedEmail)) return 'emailInvalid';
  if (!password) return 'passwordRequired';
  return null;
}

export async function signIn(email: string, password: string): Promise<MfaChallenge> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    errorCode?: AuthErrorCode;
  };

  if (!response.ok) {
    throw new AuthError(
      body.errorCode ?? 'invalidCredentials',
      body.error ?? 'Invalid email or password.',
    );
  }

  const data = body as LoginResponse & { requiresMfa?: boolean; mfaToken?: string; email?: string };
  if (!data.requiresMfa || !data.mfaToken) {
    throw new AuthError('invalidCredentials', 'Unexpected login response.');
  }

  return {
    mfaToken: data.mfaToken,
    email: data.email ?? email,
  };
}

export async function verifyMfa(mfaToken: string, code: string): Promise<AuthUser> {
  const response = await fetch('/api/auth/verify-mfa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfaToken, code }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    errorCode?: AuthErrorCode;
    user?: AuthUser;
    token?: string;
  };

  if (!response.ok) {
    throw new AuthError(
      body.errorCode ?? 'invalidMfaCode',
      body.error ?? 'Invalid authentication code.',
    );
  }

  if (!body.user || !body.token) {
    throw new AuthError('invalidMfaCode', 'Unexpected MFA response.');
  }

  return storeSession(body.user, body.token);
}

export async function signOut(): Promise<void> {
  const token = getAuthToken();
  try {
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    }
  } catch {
    // Always clear local session even if logout audit fails.
  } finally {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getPostLoginPath(user: AuthUser): string {
  if (user.mustChangePassword) {
    return '/change-password';
  }
  return getDefaultPath(user.roles ?? user.role);
}
