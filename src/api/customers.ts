import type {
  CustomerFieldValue,
  CustomerFieldValuePayload,
  CustomerPayload,
  CustomerRecord,
} from '../types/customer';
import { getAuthToken } from '../utils/auth';

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchCustomerRecords(): Promise<CustomerRecord[]> {
  const response = await fetch('/api/customers/records', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load customers');
  }

  const data = (await response.json()) as { customers: CustomerRecord[] };
  return data.customers;
}

export async function fetchCustomerById(customerId: string): Promise<CustomerRecord> {
  const response = await fetch(`/api/customers/records/${customerId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load customer');
  }

  return response.json() as Promise<CustomerRecord>;
}

export async function createCustomer(payload: CustomerPayload): Promise<CustomerRecord> {
  const response = await fetch('/api/customers/records', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as CustomerRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as CustomerRecord;
}

export async function updateCustomer(
  customerId: string,
  payload: CustomerPayload,
): Promise<CustomerRecord> {
  const response = await fetch(`/api/customers/records/${customerId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as CustomerRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as CustomerRecord;
}

export async function deleteCustomer(customerId: string): Promise<CustomerRecord> {
  const response = await fetch(`/api/customers/records/${customerId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  const data = (await response.json()) as CustomerRecord | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as CustomerRecord;
}

export async function fetchCustomerFieldValues(
  customerId: string,
  fieldReference?: 1 | 2,
): Promise<CustomerFieldValue[]> {
  const query = fieldReference ? `?fieldReference=${fieldReference}` : '';
  const response = await fetch(`/api/customers/records/${customerId}/field-values${query}`, {
    headers: authHeaders(),
  });

  const data = (await response.json()) as { values: CustomerFieldValue[] } | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return (data as { values: CustomerFieldValue[] }).values;
}

export async function createCustomerFieldValue(
  customerId: string,
  payload: CustomerFieldValuePayload,
): Promise<CustomerFieldValue> {
  const response = await fetch(`/api/customers/records/${customerId}/field-values`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as CustomerFieldValue | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as CustomerFieldValue;
}

export async function updateCustomerFieldValue(
  customerId: string,
  fieldValueId: string,
  payload: CustomerFieldValuePayload,
): Promise<CustomerFieldValue> {
  const response = await fetch(
    `/api/customers/records/${customerId}/field-values/${fieldValueId}`,
    {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    },
  );

  const data = (await response.json()) as CustomerFieldValue | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as CustomerFieldValue;
}

export async function deleteCustomerFieldValue(
  customerId: string,
  fieldValueId: string,
): Promise<CustomerFieldValue> {
  const response = await fetch(
    `/api/customers/records/${customerId}/field-values/${fieldValueId}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  );

  const data = (await response.json()) as CustomerFieldValue | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as CustomerFieldValue;
}

export async function replaceCustomerFieldValues(
  customerId: string,
  fieldReference: 1 | 2,
  items: CustomerFieldValuePayload[],
): Promise<CustomerFieldValue[]> {
  const response = await fetch(
    `/api/customers/records/${customerId}/field-options/${fieldReference}`,
    {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ items }),
    },
  );

  const data = (await response.json()) as { values: CustomerFieldValue[] } | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return (data as { values: CustomerFieldValue[] }).values;
}
