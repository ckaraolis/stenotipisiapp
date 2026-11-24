import type { Language } from '../i18n/translations';
import type { UserRole } from '../config/roles';
import type { Permission } from '../config/permissions';
import type { UserStatus } from '../types/user';
import { getAuthToken } from '../utils/auth';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName: string;
  roles: UserRole[];
  role: UserRole;
  permissions?: readonly Permission[];
  contactPhone: string;
  mobilePhone: string;
  language: Language;
  autoRefresh: boolean;
  status: UserStatus;
  customerId: string | null;
  customerName: string | null;
  mustChangePassword: boolean;
}

export interface ProfileUpdatePayload {
  fullName: string;
  username?: string;
  email?: string;
  contactPhone: string;
  mobilePhone: string;
  language?: Language;
  autoRefresh?: boolean;
}

export interface ProfileUpdateResponse {
  user: UserProfile;
  emailChanged: boolean;
}

export interface CustomerOption {
  id: string;
  name: string;
  alias: string;
}

export interface UserDetailsPayload {
  fullName: string;
  username: string;
  email: string;
  password?: string;
  contactPhone: string;
  mobilePhone: string;
  customerId: string | null;
  language: Language;
  roles: UserRole[];
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchProfile(): Promise<UserProfile> {
  const response = await fetch('/api/profile', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load profile');
  }

  return response.json() as Promise<UserProfile>;
}

export async function updateProfile(payload: ProfileUpdatePayload): Promise<ProfileUpdateResponse> {
  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as ProfileUpdateResponse | { errors?: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as ProfileUpdateResponse;
}

export async function fetchUsers(): Promise<UserProfile[]> {
  const response = await fetch('/api/users', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load users');
  }

  const data = (await response.json()) as { users: UserProfile[] };
  return data.users;
}

export async function fetchUserById(userId: string): Promise<UserProfile> {
  const response = await fetch(`/api/users/${userId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load user');
  }

  return response.json() as Promise<UserProfile>;
}

export async function fetchCustomers(): Promise<CustomerOption[]> {
  const response = await fetch('/api/customers', {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load customers');
  }

  const data = (await response.json()) as { customers: CustomerOption[] };
  return data.customers;
}

export interface UserImportRow {
  Username?: string;
  Alias?: string;
  'Full Name'?: string;
  Name?: string;
  Email?: string;
  Roles?: string;
  Role?: string;
  Status?: string;
  Customer?: string;
  'Contact Phone'?: string;
  'Mobile Phone'?: string;
  Language?: string;
  [key: string]: string | undefined;
}

export interface UserImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string; detail?: string }>;
}

export async function createUser(payload: UserDetailsPayload): Promise<UserProfile> {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as UserProfile | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as UserProfile;
}

export async function importUserRows(rows: UserImportRow[]): Promise<UserImportResult> {
  const response = await fetch('/api/users/import', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ rows }),
  });

  const data = (await response.json()) as UserImportResult | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as UserImportResult;
}

export async function updateUser(
  userId: string,
  payload: UserDetailsPayload,
): Promise<UserProfile> {
  const response = await fetch(`/api/users/${userId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as UserProfile | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as UserProfile;
}

export interface ResetUserPasswordResult {
  user: UserProfile;
  temporaryPassword: string;
}

export async function resetUserPassword(userId: string): Promise<ResetUserPasswordResult> {
  const response = await fetch(`/api/users/${userId}/reset-password`, {
    method: 'POST',
    headers: authHeaders(),
  });

  const data = (await response.json()) as ResetUserPasswordResult | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as ResetUserPasswordResult;
}

export async function updateUserStatus(
  userId: string,
  status: UserStatus,
): Promise<UserProfile> {
  const response = await fetch(`/api/users/${userId}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error('Failed to update user status');
  }

  return response.json() as Promise<UserProfile>;
}

export async function deleteUser(userId: string): Promise<void> {
  const response = await fetch(`/api/users/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  const data = (await response.json()) as { errors?: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(payload: ChangePasswordPayload): Promise<UserProfile> {
  const response = await fetch('/api/profile/password', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as UserProfile | { errors: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as UserProfile;
}
