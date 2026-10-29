import crypto from 'node:crypto';
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.js';

const MFA_TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, { userId: string, expiresAt: number }>} */
const localSessions = new Map();

function purgeLocalExpired() {
  const now = Date.now();
  for (const [token, session] of localSessions.entries()) {
    if (session.expiresAt <= now) {
      localSessions.delete(token);
    }
  }
}

export async function createMfaSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + MFA_TTL_MS;

  if (!isSupabaseConfigured()) {
    purgeLocalExpired();
    localSessions.set(token, { userId, expiresAt });
    return token;
  }

  const supabase = getSupabaseAdmin();
  await supabase.from('mfa_challenges').delete().lt('expires_at', new Date().toISOString());
  const { error } = await supabase.from('mfa_challenges').insert({
    token,
    user_id: userId,
    expires_at: new Date(expiresAt).toISOString(),
  });
  if (error) {
    throw new Error(`Failed to create MFA challenge: ${error.message}`);
  }
  return token;
}

export async function consumeMfaSession(token) {
  if (!token) return null;

  if (!isSupabaseConfigured()) {
    purgeLocalExpired();
    const session = localSessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      localSessions.delete(token);
      return null;
    }
    localSessions.delete(token);
    return session.userId;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('mfa_challenges')
    .select('token, user_id, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read MFA challenge: ${error.message}`);
  }
  if (!data) return null;

  await supabase.from('mfa_challenges').delete().eq('token', token);

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return null;
  }
  return data.user_id;
}
