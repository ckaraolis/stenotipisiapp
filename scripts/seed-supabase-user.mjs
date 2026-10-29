/**
 * Upsert the development seed user into the Supabase users collection.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-supabase-user.mjs
 */
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SEED_PASSWORD = 'Xka123!';
const SEED_EMAIL = 'c.karaolis@galatariotis.com';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function generateTotpSecret() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const bytes = crypto.randomBytes(20);
  for (let i = 0; i < bytes.length; i += 1) {
    secret += alphabet[bytes[i] % alphabet.length];
  }
  return secret;
}

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existing, error: readError } = await supabase
  .from('app_collections')
  .select('payload')
  .eq('name', 'users')
  .maybeSingle();

if (readError) {
  console.error(readError.message);
  process.exit(1);
}

const now = new Date().toISOString();
const seedUser = {
  id: 'usr-001',
  email: SEED_EMAIL,
  username: 'XKA',
  passwordHash: hashPassword(SEED_PASSWORD),
  passwordHistory: [],
  passwordChangedAt: now,
  fullName: 'Χριστόφορος Καραυλής',
  roles: ['super_admin'],
  contactPhone: '',
  mobilePhone: '99190978',
  language: 'en',
  autoRefresh: false,
  status: 'active',
  customerId: null,
  mustChangePassword: false,
  mfaEnabled: true,
  totpSecret: generateTotpSecret(),
  createdAt: now,
};

const users = Array.isArray(existing?.payload?.users) ? [...existing.payload.users] : [];
const index = users.findIndex((user) => user.email?.toLowerCase() === SEED_EMAIL);
if (index === -1) {
  users.push(seedUser);
} else {
  users[index] = {
    ...users[index],
    ...seedUser,
    totpSecret: users[index].totpSecret || seedUser.totpSecret,
    passwordHash: seedUser.passwordHash,
  };
}

const { error } = await supabase.from('app_collections').upsert(
  {
    name: 'users',
    payload: { users },
    updated_at: now,
  },
  { onConflict: 'name' },
);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const final = users.find((user) => user.email?.toLowerCase() === SEED_EMAIL);
console.log(`Seed user ready: ${SEED_EMAIL} / ${SEED_PASSWORD}`);
console.log(`TOTP secret: ${final.totpSecret}`);
