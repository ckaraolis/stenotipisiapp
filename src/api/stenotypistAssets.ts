import type {
  StenotypistAsset,
  StenotypistAssetPayload,
} from '../types/stenotypistAsset';
import { getAuthToken } from '../utils/auth';

export type { StenotypistAsset, StenotypistAssetPayload };

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchStenotypistAssets(): Promise<StenotypistAsset[]> {
  const response = await fetch('/api/stenotypist-assets', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load stenotypist assets');
  }

  const data = (await response.json()) as { assets: StenotypistAsset[] };
  return data.assets;
}

export async function fetchStenotypistAssetById(assetId: string): Promise<StenotypistAsset> {
  const response = await fetch(`/api/stenotypist-assets/${assetId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load stenotypist asset');
  }

  return response.json() as Promise<StenotypistAsset>;
}

export async function createStenotypistAsset(
  payload: StenotypistAssetPayload,
): Promise<StenotypistAsset> {
  const response = await fetch('/api/stenotypist-assets', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as StenotypistAsset | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as StenotypistAsset;
}

export async function updateStenotypistAsset(
  assetId: string,
  payload: StenotypistAssetPayload,
): Promise<StenotypistAsset> {
  const response = await fetch(`/api/stenotypist-assets/${assetId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as StenotypistAsset | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as StenotypistAsset;
}

export async function deleteStenotypistAsset(assetId: string): Promise<void> {
  const response = await fetch(`/api/stenotypist-assets/${assetId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  const data = (await response.json()) as { errors?: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }
}
