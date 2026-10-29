/**
 * Import local database/*.json collections into Supabase app_collections.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-json-to-supabase.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '..', 'database');

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const files = fs
  .readdirSync(DB_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort();

let imported = 0;
for (const file of files) {
  const name = file.replace(/\.json$/, '');
  const payload = JSON.parse(fs.readFileSync(path.join(DB_DIR, file), 'utf8'));
  const { error } = await supabase.from('app_collections').upsert(
    {
      name,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'name' },
  );
  if (error) {
    console.error(`Failed ${name}:`, error.message);
    process.exit(1);
  }
  console.log(`imported ${name}`);
  imported += 1;
}

console.log(`Done. Imported ${imported} collections.`);
