import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
  collectionExists,
  DB_DIR,
} from './collectionStore.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { findUserById } from './db.js';
import { normalizeRoles } from './roles.js';


const ASSETS_PATH = path.join(__dirname, '..', 'database', 'stenotypistAssets.json');

function readAssetsFile() {
  ensureCollectionFile('stenotypistAssets', { assets: [] });
  return readCollection('stenotypistAssets', { assets: [] });
}

function writeAssetsFile(data) {
  writeCollection('stenotypistAssets', data);
}

export function ensureAssetsFile() {
  ensureCollectionFile('stenotypistAssets', { assets: [] });
}

function generateAssetId() {
  return `sta-${crypto.randomUUID().slice(0, 8)}`;
}

function userIsStenotypist(userId) {
  const user = findUserById(userId);
  if (!user) return false;
  return normalizeRoles(user).includes('stenotypist');
}

function findAssetByStenotypistId(stenotypistId) {
  const data = readAssetsFile();
  return data.assets.find((asset) => asset.stenotypistId === stenotypistId) ?? null;
}

function toPublicAsset(asset) {
  const user = findUserById(asset.stenotypistId);
  if (!user) {
    return null;
  }

  return {
    id: asset.id,
    stenotypistId: asset.stenotypistId,
    stenotypistName: user.fullName,
    stenotypistUsername: user.username,
    laptopSerialNumber: asset.laptopSerialNumber ?? '',
    stenotypeMachineSerialNumber: asset.stenotypeMachineSerialNumber ?? '',
    catalystProductKey: asset.catalystProductKey ?? '',
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

function validateAssetInput(input, { existingId = null } = {}) {
  const errors = [];
  const stenotypistId =
    typeof input.stenotypistId === 'string' ? input.stenotypistId.trim() : '';
  const laptopSerialNumber =
    typeof input.laptopSerialNumber === 'string' ? input.laptopSerialNumber.trim() : '';
  const stenotypeMachineSerialNumber =
    typeof input.stenotypeMachineSerialNumber === 'string'
      ? input.stenotypeMachineSerialNumber.trim()
      : '';
  const catalystProductKey =
    typeof input.catalystProductKey === 'string' ? input.catalystProductKey.trim() : '';

  if (!stenotypistId) {
    errors.push('stenotypistRequired');
  } else if (!userIsStenotypist(stenotypistId)) {
    errors.push('stenotypistInvalid');
  } else {
    const duplicate = findAssetByStenotypistId(stenotypistId);
    if (duplicate && duplicate.id !== existingId) {
      errors.push('stenotypistAssetExists');
    }
  }

  return {
    errors,
    value: {
      stenotypistId,
      laptopSerialNumber,
      stenotypeMachineSerialNumber,
      catalystProductKey,
    },
  };
}

export function listStenotypistAssets() {
  const data = readAssetsFile();
  return data.assets
    .map((asset) => toPublicAsset(asset))
    .filter((asset) => asset !== null)
    .sort((a, b) => a.stenotypistName.localeCompare(b.stenotypistName, undefined, { sensitivity: 'base' }));
}

export function findStenotypistAssetById(id) {
  const data = readAssetsFile();
  const asset = data.assets.find((row) => row.id === id);
  if (!asset) return null;
  return toPublicAsset(asset);
}

export function createStenotypistAsset(input) {
  const { errors, value } = validateAssetInput(input);
  if (errors.length > 0) {
    return { errors };
  }

  const now = new Date().toISOString();
  const asset = {
    id: generateAssetId(),
    stenotypistId: value.stenotypistId,
    laptopSerialNumber: value.laptopSerialNumber,
    stenotypeMachineSerialNumber: value.stenotypeMachineSerialNumber,
    catalystProductKey: value.catalystProductKey,
    createdAt: now,
    updatedAt: now,
  };

  const data = readAssetsFile();
  data.assets.push(asset);
  writeAssetsFile(data);
  return { asset: toPublicAsset(asset) };
}

export function updateStenotypistAsset(assetId, input) {
  const data = readAssetsFile();
  const index = data.assets.findIndex((row) => row.id === assetId);
  if (index === -1) {
    return { errors: ['stenotypistAssetNotFound'] };
  }

  const current = data.assets[index];
  const { errors, value } = validateAssetInput(
    {
      stenotypistId: input.stenotypistId ?? current.stenotypistId,
      laptopSerialNumber: input.laptopSerialNumber,
      stenotypeMachineSerialNumber: input.stenotypeMachineSerialNumber,
      catalystProductKey: input.catalystProductKey,
    },
    { existingId: assetId },
  );

  if (errors.length > 0) {
    return { errors };
  }

  const updated = {
    ...current,
    stenotypistId: value.stenotypistId,
    laptopSerialNumber: value.laptopSerialNumber,
    stenotypeMachineSerialNumber: value.stenotypeMachineSerialNumber,
    catalystProductKey: value.catalystProductKey,
    updatedAt: new Date().toISOString(),
  };

  data.assets[index] = updated;
  writeAssetsFile(data);
  return { asset: toPublicAsset(updated) };
}

export function deleteStenotypistAsset(assetId) {
  const data = readAssetsFile();
  const index = data.assets.findIndex((row) => row.id === assetId);
  if (index === -1) {
    return { errors: ['stenotypistAssetNotFound'] };
  }

  const [removed] = data.assets.splice(index, 1);
  writeAssetsFile(data);
  return { asset: toPublicAsset(removed) };
}

export function deleteStenotypistAssetsForUser(userId) {
  const data = readAssetsFile();
  const before = data.assets.length;
  data.assets = data.assets.filter((asset) => asset.stenotypistId !== userId);
  if (data.assets.length !== before) {
    writeAssetsFile(data);
  }
}
