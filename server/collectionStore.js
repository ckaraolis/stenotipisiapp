import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabaseAdmin, isSupabaseConfigured, isVercelRuntime } from './supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// On Vercel the deploy filesystem is read-only; use /tmp only as a last-resort local cache.
export const DB_DIR = isVercelRuntime()
  ? path.join('/tmp', 'stenotipisi-database')
  : path.join(__dirname, '..', 'database');

/** @type {Map<string, unknown>} */
const cache = new Map();
/** @type {Set<string>} */
const pendingPersists = new Set();
let hydrated = false;
let hydratePromise = null;

export function useRemoteStore() {
  return isSupabaseConfigured();
}

function clone(value) {
  return structuredClone(value);
}

export async function hydrateFromSupabase({ force = false } = {}) {
  if (!useRemoteStore()) {
    hydrated = true;
    return;
  }
  if (hydrated && !force) return;

  // Serialize hydrates so a force refresh never races an in-flight load.
  if (hydratePromise) {
    await hydratePromise;
    if (hydrated && !force) return;
  }

  hydratePromise = (async () => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('app_collections').select('name, payload');
    if (error) {
      throw new Error(
        `Failed to hydrate app_collections: ${error.message}. Run supabase/migrations/20261027120000_init.sql in the Supabase SQL editor.`,
      );
    }
    cache.clear();
    for (const row of data ?? []) {
      cache.set(row.name, row.payload ?? {});
    }
    hydrated = true;
  })();

  try {
    await hydratePromise;
  } finally {
    hydratePromise = null;
  }
}

export function resetCollectionCache() {
  cache.clear();
  pendingPersists.clear();
  hydrated = false;
  hydratePromise = null;
}

function localPathFor(collectionName) {
  return path.join(DB_DIR, `${collectionName}.json`);
}

export function readCollection(collectionName, fallback = {}) {
  if (useRemoteStore()) {
    if (!hydrated) {
      throw new Error(
        `Collection store not hydrated before reading "${collectionName}". Call hydrateFromSupabase() first.`,
      );
    }
    if (!cache.has(collectionName)) {
      cache.set(collectionName, clone(fallback));
    }
    return clone(cache.get(collectionName));
  }

  const filePath = localPathFor(collectionName);
  if (!fs.existsSync(filePath)) {
    return clone(fallback);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function persistCollection(collectionName, payload) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('app_collections').upsert(
    {
      name: collectionName,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'name' },
  );
  if (error) {
    console.error(`[collectionStore] Failed to persist ${collectionName}:`, error.message);
    throw new Error(`Failed to persist ${collectionName}: ${error.message}`);
  }
}

export function writeCollection(collectionName, data) {
  const payload = clone(data);

  if (useRemoteStore()) {
    cache.set(collectionName, payload);
    pendingPersists.add(collectionName);
    // Fire-and-forget; request middleware awaits flushPendingWrites().
    void persistCollection(collectionName, payload)
      .then(() => {
        pendingPersists.delete(collectionName);
      })
      .catch((error) => {
        console.error(error);
      });
    return;
  }

  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.writeFileSync(localPathFor(collectionName), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function writeCollectionAsync(collectionName, data) {
  const payload = clone(data);
  if (useRemoteStore()) {
    cache.set(collectionName, payload);
    await persistCollection(collectionName, payload);
    pendingPersists.delete(collectionName);
    return;
  }
  writeCollection(collectionName, payload);
}

export async function flushPendingWrites() {
  const tasks = [];
  if (useRemoteStore() && pendingPersists.size > 0) {
    const names = [...pendingPersists];
    tasks.push(
      ...names.map(async (name) => {
        const payload = cache.get(name);
        if (payload === undefined) {
          pendingPersists.delete(name);
          return;
        }
        await persistCollection(name, payload);
        pendingPersists.delete(name);
      }),
    );
  }
  const { flushPendingTranscriptUploads } = await import('./transcriptFileStorage.js');
  tasks.push(flushPendingTranscriptUploads());
  await Promise.all(tasks);
}

export function ensureCollectionFile(collectionName, fallback = {}) {
  if (useRemoteStore()) {
    if (!cache.has(collectionName)) {
      cache.set(collectionName, clone(fallback));
      pendingPersists.add(collectionName);
    }
    return;
  }
  const filePath = localPathFor(collectionName);
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(fallback, null, 2)}\n`, 'utf8');
  }
}

export function collectionExists(collectionName) {
  if (useRemoteStore()) {
    return cache.has(collectionName);
  }
  return fs.existsSync(localPathFor(collectionName));
}
