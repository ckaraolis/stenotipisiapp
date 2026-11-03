import { createClient } from '@supabase/supabase-js';

let client = null;

function env(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

/** Resolve URL from common Vercel ↔ Supabase integration names. */
export function getSupabaseUrl() {
  return (
    env('SUPABASE_URL') ||
    env('NEXT_PUBLIC_SUPABASE_URL') ||
    env('VITE_SUPABASE_URL') ||
    env('PUBLIC_SUPABASE_URL')
  );
}

/** Resolve service-role key from common integration names. */
export function getSupabaseServiceRoleKey() {
  return (
    env('SUPABASE_SERVICE_ROLE_KEY') ||
    env('SUPABASE_SECRET_KEY') ||
    env('SUPABASE_SERVICE_KEY')
  );
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

export function getSupabaseAdmin() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  if (!client) {
    client = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function getStorageBucket() {
  return env('SUPABASE_STORAGE_BUCKET') || 'transcript-files';
}

export function isVercelRuntime() {
  return process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
}
