import { listCustomerRecords } from './customers.js';
import {
  createUser,
  findUserByUsername,
  updateUser,
  updateUserStatus,
} from './db.js';
import { normalizeRole, normalizeRoles, validateRolesForCustomer } from './roles.js';

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value.replace(/^\uFEFF/, '').trim();
  return String(value).replace(/^\uFEFF/, '').trim();
}

function normalizeCompare(value) {
  return normalizeText(value)
    .toLocaleLowerCase('el-GR')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeStatus(value, fallback = 'active') {
  const text = normalizeText(value).toLowerCase();
  if (!text) return fallback;
  if (['active', 'enabled', 'enable', 'yes', 'true', '1'].includes(text)) return 'active';
  if (['inactive', 'disabled', 'disable', 'no', 'false', '0'].includes(text)) return 'inactive';
  return fallback;
}

function sanitizeEmailLocalPart(username) {
  const ascii = normalizeText(username)
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._+-]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  if (ascii) return ascii.slice(0, 48);
  // Keep a stable placeholder for Greek-only usernames.
  let hash = 0;
  const source = normalizeText(username);
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return `user${hash.toString(16)}`;
}

function buildImportEmail(username, providedEmail) {
  const email = normalizeText(providedEmail);
  if (email) return email;
  return `${sanitizeEmailLocalPart(username)}@imported.local`;
}

function parseRoles(value, customerId) {
  const text = normalizeText(value);
  if (!text) {
    return customerId ? ['transcript_owner'] : ['stenotypist'];
  }
  const roles = normalizeRoles(
    text
      .split(/[,;/|]+/)
      .map((part) => normalizeText(part))
      .filter(Boolean)
      .map((part) => normalizeRole(part)),
  );
  return roles.length > 0 ? roles : customerId ? ['transcript_owner'] : ['stenotypist'];
}

function findCustomerForImport(customerNameOrAlias) {
  const needle = normalizeCompare(customerNameOrAlias);
  if (!needle) return null;
  const customers = listCustomerRecords();
  return (
    customers.find((customer) => normalizeCompare(customer.name) === needle) ||
    customers.find((customer) => normalizeCompare(customer.alias) === needle) ||
    null
  );
}

function getImportField(raw, ...keys) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') {
      return raw[key];
    }
  }
  const entries = Object.entries(raw ?? {});
  for (const key of keys) {
    const needle = String(key).trim().toLowerCase().replace(/[\s_]+/g, '');
    const match = entries.find(
      ([header]) => String(header).trim().toLowerCase().replace(/[\s_]+/g, '') === needle,
    );
    if (match && match[1] !== undefined && match[1] !== null && String(match[1]).trim() !== '') {
      return match[1];
    }
  }
  return undefined;
}

function normalizeImportRow(raw = {}) {
  const username = normalizeText(
    getImportField(raw, 'Username', 'Alias', 'User Alias', 'User', 'username', 'alias'),
  );
  const fullName = normalizeText(
    getImportField(raw, 'Full Name', 'Name', 'FullName', 'fullName', 'Display Name'),
  );
  return {
    username,
    fullName: fullName || username,
    email: normalizeText(getImportField(raw, 'Email', 'E-mail', 'Contact Email', 'email')),
    roles: getImportField(raw, 'Roles', 'Role', 'roles', 'role'),
    status: getImportField(raw, 'Status', 'Enabled', 'status', 'enabled'),
    customer: normalizeText(
      getImportField(raw, 'Customer', 'Customer Name', 'Customer Alias', 'customer'),
    ),
    contactPhone: normalizeText(
      getImportField(raw, 'Contact Phone', 'Phone', 'contactPhone', 'Telephone'),
    ),
    mobilePhone: normalizeText(
      getImportField(raw, 'Mobile Phone', 'Mobile', 'mobilePhone', 'Cell'),
    ),
    language: normalizeText(getImportField(raw, 'Language', 'language', 'Lang')),
  };
}

/**
 * Import users from Excel (ASTRAEA-style / minimal test sheets).
 * Required: Username. Useful columns: Full Name, Customer, Language, Status, Role.
 * Matching key: username/alias (case-insensitive).
 * Missing email becomes {username}@imported.local so Email/phones can be filled later.
 * Default role: stenotypist (or transcript_owner when a customer is set).
 * Enrollment emails are not sent.
 */
export function importUsers(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const summary = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  list.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = normalizeImportRow(rawRow);
    if (!row.username && !row.fullName && !row.email) {
      summary.skipped += 1;
      return;
    }
    if (!row.username) {
      summary.errors.push({ row: rowNumber, message: 'usernameRequired' });
      summary.skipped += 1;
      return;
    }

    const customer = row.customer ? findCustomerForImport(row.customer) : null;
    if (row.customer && !customer) {
      summary.errors.push({
        row: rowNumber,
        message: 'customerInvalid',
        detail: row.customer,
      });
      summary.skipped += 1;
      return;
    }

    const customerId = customer?.id ?? null;
    const roles = parseRoles(row.roles, customerId);
    if (!validateRolesForCustomer(customerId, roles)) {
      summary.errors.push({
        row: rowNumber,
        message: 'rolesInvalidForCustomer',
        detail: roles.join(', '),
      });
      summary.skipped += 1;
      return;
    }

    const payload = {
      username: row.username,
      fullName: row.fullName || row.username,
      email: buildImportEmail(row.username, row.email),
      roles,
      customerId,
      contactPhone: row.contactPhone,
      mobilePhone: row.mobilePhone,
      language: row.language.toLowerCase().startsWith('el') ? 'el' : 'en',
    };

    const existing = findUserByUsername(row.username);
    if (existing) {
      const result = updateUser(existing.id, {
        ...payload,
        // Keep existing email if import row has no email, to avoid collisions
        // on regenerated @imported.local addresses.
        email: row.email ? payload.email : existing.email,
        language: existing.language === 'el' || payload.language === 'el' ? 'el' : 'en',
        contactPhone: row.contactPhone || existing.contactPhone || '',
        mobilePhone: row.mobilePhone || existing.mobilePhone || '',
      });
      if (result.errors) {
        summary.errors.push({
          row: rowNumber,
          message: result.errors[0],
          detail: row.username,
        });
        summary.skipped += 1;
        return;
      }
      const status = normalizeStatus(row.status, existing.status || 'active');
      updateUserStatus(existing.id, status);
      summary.updated += 1;
      return;
    }

    const result = createUser(payload);
    if (result.errors) {
      summary.errors.push({
        row: rowNumber,
        message: result.errors[0],
        detail: row.username,
      });
      summary.skipped += 1;
      return;
    }

    const status = normalizeStatus(row.status, 'active');
    if (status !== 'active') {
      updateUserStatus(result.user.id, status);
    }
    summary.created += 1;
  });

  return summary;
}
