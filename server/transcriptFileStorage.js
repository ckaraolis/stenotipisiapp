import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getStorageBucket, getSupabaseAdmin, isSupabaseConfigured } from './supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_ROOT = path.join(__dirname, '..', 'database', 'transcript-files');

/** @type {Map<string, Buffer>} */
const memoryBinaries = new Map();
/** @type {Map<string, { transcriptId: string, storageId: string, buffer: Buffer }>} */
const pendingUploads = new Map();

function objectPath(transcriptId, storageId) {
  return `${transcriptId}/${storageId}`;
}

export function ensureTranscriptFileStorageRoot() {
  if (isSupabaseConfigured()) return;
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

export function createStorageId() {
  return `stor-${crypto.randomUUID()}`;
}

export function getTranscriptFileStoragePath(transcriptId, storageId) {
  return path.join(STORAGE_ROOT, transcriptId, storageId);
}

export function storeTranscriptFileBinary(transcriptId, storageId, buffer) {
  const key = objectPath(transcriptId, storageId);
  memoryBinaries.set(key, buffer);

  if (isSupabaseConfigured()) {
    pendingUploads.set(key, { transcriptId, storageId, buffer });
    return `supabase://${getStorageBucket()}/${key}`;
  }

  ensureTranscriptFileStorageRoot();
  const dir = path.join(STORAGE_ROOT, transcriptId);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, storageId);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export function readTranscriptFileBinary(transcriptId, storageId) {
  const key = objectPath(transcriptId, storageId);
  if (memoryBinaries.has(key)) {
    return memoryBinaries.get(key);
  }

  if (isSupabaseConfigured()) {
    return null;
  }

  const filePath = getTranscriptFileStoragePath(transcriptId, storageId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath);
}

export async function readTranscriptFileBinaryAsync(transcriptId, storageId) {
  const cached = readTranscriptFileBinary(transcriptId, storageId);
  if (cached) return cached;

  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(getStorageBucket())
    .download(objectPath(transcriptId, storageId));
  if (error || !data) {
    return null;
  }
  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  memoryBinaries.set(objectPath(transcriptId, storageId), buffer);
  return buffer;
}

export async function flushPendingTranscriptUploads() {
  if (!isSupabaseConfigured() || pendingUploads.size === 0) return;
  const supabase = getSupabaseAdmin();
  const entries = [...pendingUploads.entries()];
  await Promise.all(
    entries.map(async ([key, entry]) => {
      const { error } = await supabase.storage
        .from(getStorageBucket())
        .upload(objectPath(entry.transcriptId, entry.storageId), entry.buffer, {
          upsert: true,
          contentType: 'application/octet-stream',
        });
      if (error) {
        console.error(`[transcript-storage] Failed to upload ${key}:`, error.message);
        return;
      }
      pendingUploads.delete(key);
    }),
  );
}

export function decodeUploadContent(contentBase64) {
  if (typeof contentBase64 !== 'string' || !contentBase64.trim()) {
    return null;
  }
  try {
    return Buffer.from(contentBase64, 'base64');
  } catch {
    return null;
  }
}
