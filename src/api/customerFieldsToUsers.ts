import type {
  CustomerFieldUserImportResult,
  CustomerFieldUserImportRow,
  CustomerFieldUserMapping,
  CustomerFieldUserOption,
  CustomerFieldUserPayload,
} from '../types/customerFieldUser';
import { getAuthToken } from '../utils/auth';

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchCustomerFieldUserMappings(): Promise<CustomerFieldUserMapping[]> {
  const response = await fetch('/api/customer-fields-to-users/records', {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to load customer field user mappings');
  }
  const data = (await response.json()) as { mappings: CustomerFieldUserMapping[] };
  return data.mappings;
}

export async function fetchCustomerFieldUserOptions(): Promise<CustomerFieldUserOption[]> {
  const response = await fetch('/api/customer-fields-to-users/user-options', {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to load users');
  }
  const data = (await response.json()) as { users: CustomerFieldUserOption[] };
  return data.users;
}

export async function fetchCustomerFieldUserMappingById(
  mappingId: string,
): Promise<CustomerFieldUserMapping> {
  const response = await fetch(`/api/customer-fields-to-users/records/${mappingId}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to load mapping');
  }
  return response.json() as Promise<CustomerFieldUserMapping>;
}

export async function createCustomerFieldUserMapping(
  payload: CustomerFieldUserPayload,
): Promise<CustomerFieldUserMapping> {
  const response = await fetch('/api/customer-fields-to-users/records', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as CustomerFieldUserMapping | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data as CustomerFieldUserMapping;
}

export async function updateCustomerFieldUserMapping(
  mappingId: string,
  payload: CustomerFieldUserPayload,
): Promise<CustomerFieldUserMapping> {
  const response = await fetch(`/api/customer-fields-to-users/records/${mappingId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as CustomerFieldUserMapping | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data as CustomerFieldUserMapping;
}

export async function deleteCustomerFieldUserMapping(
  mappingId: string,
): Promise<CustomerFieldUserMapping> {
  const response = await fetch(`/api/customer-fields-to-users/records/${mappingId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = (await response.json()) as CustomerFieldUserMapping | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data as CustomerFieldUserMapping;
}

export async function importCustomerFieldUserRows(
  rows: CustomerFieldUserImportRow[],
): Promise<CustomerFieldUserImportResult> {
  const response = await fetch('/api/customer-fields-to-users/import', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ rows }),
  });
  const raw = await response.text();
  let data: CustomerFieldUserImportResult | { errors: string[] };
  try {
    data = JSON.parse(raw) as CustomerFieldUserImportResult | { errors: string[] };
  } catch {
    throw new Error(
      JSON.stringify({
        errors: ['customerFieldUserImportError'],
        detail: raw.slice(0, 200) || `HTTP ${response.status}`,
      }),
    );
  }
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data as CustomerFieldUserImportResult;
}
