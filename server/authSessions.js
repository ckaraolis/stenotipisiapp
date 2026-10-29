import crypto from 'node:crypto';
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.js';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** @type {Map<string, { userId: string, expiresAt: number }>} */
const sessionCache = new Map();
let hydrated = false;

function useRemote() {
  return isSupabaseConfigured();
}

export async function hydrateAuthSessions() {
  if (!useRemote()) {
    hydrated = true;
    return;
  }
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('token, user_id, expires_at, revoked_at')
    .is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (error) {
    throw new Error(`Failed to hydrate auth_sessions: ${error.message}`);
  }

  sessionCache.clear();
  for (const row of data ?? []) {
    sessionCache.set(row.token, {
      userId: row.user_id,
      expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : Number.MAX_SAFE_INTEGER,
    });
  }
  hydrated = true;
}

export function resetAuthSessionCache() {
  sessionCache.clear();
  hydrated = false;
}

export async function createAuthSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;

  if (!useRemote()) {
    return `local-${userId}`;
  }

  if (!hydrated) {
    await hydrateAuthSessions();
  }

  const expiresAtIso = new Date(expiresAt).toISOString();
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('auth_sessions').insert({
    token,
    user_id: userId,
    expires_at: expiresAtIso,
  });
  if (error) {
    throw new Error(`Failed to create auth session: ${error.message}`);
  }

  sessionCache.set(token, { userId, expiresAt });
  return token;
}

export function getUserIdFromAuthToken(token) {
  if (typeof token !== 'string' || !token) return null;

  if (!useRemote()) {
    if (!token.startsWith('local-')) return null;
    return token.slice('local-'.length);
  }

  const session = sessionCache.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessionCache.delete(token);
    return null;
  }
  return session.userId;
}

export async function revokeAuthSession(token) {
  if (!token || !useRemote()) return;
  sessionCache.delete(token);
  const supabase = getSupabaseAdmin();
  await supabase
    .from('auth_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token', token);
}
