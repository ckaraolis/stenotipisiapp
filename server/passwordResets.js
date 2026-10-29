import crypto from 'node:crypto';
import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
  writeCollectionAsync,
  useRemoteStore,
} from './collectionStore.js';
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const COLLECTION = 'passwordResets';

function purgeExpiredResets(resets) {
  const now = Date.now();
  return resets.filter((entry) => new Date(entry.expiresAt).getTime() > now);
}

function readResetsFile() {
  ensureCollectionFile(COLLECTION, { resets: [] });
  return readCollection(COLLECTION, { resets: [] });
}

function writeResetsFile(data) {
  writeCollection(COLLECTION, data);
}

export async function createPasswordResetToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    await supabase.from('password_resets').delete().eq('user_id', userId);
    await supabase.from('password_resets').delete().lt('expires_at', new Date().toISOString());
    const { error } = await supabase.from('password_resets').insert({
      token,
      user_id: userId,
      expires_at: expiresAt,
    });
    if (error) {
      throw new Error(`Failed to create password reset token: ${error.message}`);
    }
    return token;
  }

  const data = readResetsFile();
  data.resets = purgeExpiredResets(data.resets ?? []).filter((entry) => entry.userId !== userId);
  data.resets.push({
    token,
    userId,
    expiresAt,
    createdAt: new Date().toISOString(),
  });
  writeResetsFile(data);
  return token;
}

export async function findPasswordResetToken(token) {
  if (!token) return null;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('password_resets')
      .select('token, user_id, expires_at, created_at')
      .eq('token', token)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to find password reset token: ${error.message}`);
    }
    if (!data) return null;
    if (new Date(data.expires_at).getTime() <= Date.now()) {
      return null;
    }
    return {
      token: data.token,
      userId: data.user_id,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
    };
  }

  const data = readResetsFile();
  const entry = purgeExpiredResets(data.resets ?? []).find((row) => row.token === token);
  if (!entry) return null;
  if (new Date(entry.expiresAt).getTime() <= Date.now()) {
    return null;
  }
  return entry;
}

export async function consumePasswordResetToken(token) {
  const entry = await findPasswordResetToken(token);
  if (!entry) return null;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    await supabase.from('password_resets').delete().eq('token', token);
    return entry;
  }

  const data = readResetsFile();
  data.resets = purgeExpiredResets(data.resets ?? []).filter((row) => row.token !== token);
  if (useRemoteStore()) {
    await writeCollectionAsync(COLLECTION, data);
  } else {
    writeResetsFile(data);
  }
  return entry;
}
