import crypto from 'node:crypto';
import { generateTotpSecret } from './totp.js';
import {
  normalizeRole,
  normalizeRoles,
  validateRolesForCustomer,
} from './roles.js';
import { getPermissionsForRoles } from './permissions.js';
import { userHasSystemRecords } from './userReferences.js';
import { deleteStenotypistAssetsForUser } from './stenotypistAssets.js';
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  findPasswordResetToken,
} from './passwordResets.js';
import {
  buildPasswordUpdate,
  ensurePasswordExpiryEnforced,
  SEED_PASSWORD,
  validatePasswordPolicy,
} from './passwordPolicy.js';
import {
  collectionExists,
  ensureCollectionFile,
  readCollection,
  writeCollection,
} from './collectionStore.js';
import { getUserIdFromAuthToken } from './authSessions.js';
import {
  ensureCustomersDatabase,
  findCustomerById,
  listCustomers,
} from './customers.js';
import { ensureDistrictsDatabase } from './districts.js';
import { ensureProjectsDatabase } from './projects.js';
import { ensurePublicHolidaysDatabase } from './publicHolidays.js';
import { ensureStenotypistLeavesDatabase } from './stenotypistLeaves.js';
import { ensureTravellingTimesDatabase } from './travellingTimes.js';
import { ensureJobsDatabase } from './jobs.js';
import { ensureJobSubmissionsDatabase } from './jobSubmissions.js';
import { ensureTranscriptsDatabase } from './transcripts.js';
import { ensureProformasDatabase } from './proformas.js';
import { ensurePriorityErpDatabase } from './priorityErp.js';
import { ensurePriorityErpExportsDatabase } from './priorityErpExport.js';
import { ensureStenotypistBonusDatabase } from './stenotypistBonus.js';
import { ensureStenotypistPenaltyDatabase } from './stenotypistPenalty.js';
import { ensureTravelExpensesDatabase } from './travelExpenses.js';
import { ensureJobTravelExpensesDatabase } from './jobTravelExpenses.js';

const DEFAULT_PROFILE = {
  contactPhone: '',
  mobilePhone: '',
  language: 'en',
  autoRefresh: false,
};

export const USER_STATUSES = ['active', 'inactive'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeUserStatus(status) {
  return status === 'inactive' ? 'inactive' : 'active';
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const verify = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verify, 'hex'));
}

function readUsersFile() {
  ensureCollectionFile('users', { users: [] });
  return readCollection('users', { users: [] });
}

function writeUsersFile(data) {
  writeCollection('users', data);
}

function deriveUsername(user) {
  if (user.username?.trim()) {
    return user.username.trim();
  }
  if (user.alias?.trim()) {
    return user.alias.trim();
  }
  if (user.displayName?.trim()) {
    return user.displayName.trim();
  }
  const localPart = user.email?.split('@')[0] ?? 'user';
  return localPart.slice(0, 12).toUpperCase();
}

function withProfileDefaults(user) {
  return {
    contactPhone: user.contactPhone ?? DEFAULT_PROFILE.contactPhone,
    mobilePhone: user.mobilePhone ?? DEFAULT_PROFILE.mobilePhone,
    language: user.language ?? DEFAULT_PROFILE.language,
    autoRefresh: user.autoRefresh ?? DEFAULT_PROFILE.autoRefresh,
  };
}

function migrateUsers(data) {
  let changed = false;
  data.users = (data.users ?? []).map((user) => {
    const username = deriveUsername(user);
    const roles = normalizeRoles(user);
    const migrated = {
      ...user,
      username,
      roles,
      fullName: user.fullName ?? '',
      contactPhone: user.contactPhone ?? DEFAULT_PROFILE.contactPhone,
      mobilePhone: user.mobilePhone ?? DEFAULT_PROFILE.mobilePhone,
      language: user.language ?? DEFAULT_PROFILE.language,
      autoRefresh: user.autoRefresh ?? DEFAULT_PROFILE.autoRefresh,
      status: normalizeUserStatus(user.status),
      customerId: user.customerId ?? null,
      mfaEnabled: user.mfaEnabled ?? true,
      totpSecret: user.totpSecret ?? generateTotpSecret(),
      mustChangePassword: user.mustChangePassword ?? false,
      passwordHistory: Array.isArray(user.passwordHistory) ? user.passwordHistory : [],
      passwordChangedAt: user.passwordChangedAt ?? user.createdAt ?? new Date().toISOString(),
    };

    delete migrated.displayName;
    delete migrated.alias;
    delete migrated.role;

    if (
      user.username === undefined ||
      user.alias !== undefined ||
      user.role !== undefined ||
      !Array.isArray(user.roles) ||
      user.status === undefined ||
      user.customerId === undefined ||
      user.contactPhone === undefined ||
      user.mobilePhone === undefined ||
      user.language === undefined ||
      user.autoRefresh === undefined ||
      user.mfaEnabled === undefined ||
      user.totpSecret === undefined ||
      user.mustChangePassword === undefined ||
      user.passwordHistory === undefined ||
      user.passwordChangedAt === undefined ||
      user.displayName !== undefined
    ) {
      changed = true;
    }

    return migrated;
  });

  if (changed) writeUsersFile(data);
  return data;
}

export function ensureDatabase() {
  ensureCustomersDatabase();
  ensureDistrictsDatabase();
  ensureProjectsDatabase();
  ensurePublicHolidaysDatabase();
  ensureStenotypistLeavesDatabase();
  ensureTravellingTimesDatabase();
  ensureJobsDatabase();
  ensureJobSubmissionsDatabase();
  ensureTranscriptsDatabase();
  ensureProformasDatabase();
  ensurePriorityErpDatabase();
  ensurePriorityErpExportsDatabase();
  ensureStenotypistBonusDatabase();
  ensureStenotypistPenaltyDatabase();
  ensureTravelExpensesDatabase();
  ensureJobTravelExpensesDatabase();

  if (!collectionExists('users')) {
    writeUsersFile({
      users: [createSeedUser()],
    });
    return;
  }

  let data = readUsersFile();
  const hasSeedUser = data.users?.some(
    (user) => user.email.toLowerCase() === 'c.karaolis@galatariotis.com',
  );

  if (!hasSeedUser) {
    data.users = [...(data.users ?? []), createSeedUser()];
    writeUsersFile(data);
    data = readUsersFile();
  }

  const seedUser = data.users.find(
    (user) => user.email.toLowerCase() === 'c.karaolis@galatariotis.com',
  );
  if (seedUser?.passwordHash?.includes('PLACEHOLDER')) {
    seedUser.passwordHash = hashPassword(SEED_PASSWORD);
    writeUsersFile(data);
  }

  if (seedUser && verifyPassword('1234', seedUser.passwordHash)) {
    const result = buildPasswordUpdate(seedUser, SEED_PASSWORD, hashPassword, verifyPassword);
    if (result.updates) {
      const index = data.users.findIndex(
        (user) => user.email.toLowerCase() === 'c.karaolis@galatariotis.com',
      );
      data.users[index] = { ...seedUser, ...result.updates };
      writeUsersFile(data);
    }
  }

  migrateUsers(data);
}

function applyPasswordExpiryToUser(user) {
  const enforced = ensurePasswordExpiryEnforced(user);
  if (enforced.mustChangePassword !== user.mustChangePassword) {
    const data = readUsersFile();
    const index = data.users.findIndex((row) => row.id === user.id);
    if (index !== -1) {
      data.users[index] = enforced;
      writeUsersFile(data);
    }
    return enforced;
  }
  return user;
}

export function findUserByIdWithPolicy(id) {
  const user = findUserById(id);
  if (!user) return null;
  return applyPasswordExpiryToUser(user);
}

function createSeedUser() {
  const now = new Date().toISOString();
  return {
    id: 'usr-001',
    email: 'c.karaolis@galatariotis.com',
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
    createdAt: new Date().toISOString(),
  };
}

function generateUserId() {
  return `usr-${crypto.randomUUID().slice(0, 8)}`;
}

function validateUserInput(input, { requirePassword, existingUser = null }) {
  const errors = [];
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
  const username = typeof input.username === 'string' ? input.username.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const roles = normalizeRoles(input.roles ?? []);
  const customerId =
    typeof input.customerId === 'string' && input.customerId.trim()
      ? input.customerId.trim()
      : null;
  const language = input.language === 'el' ? 'el' : 'en';
  const contactPhone =
    typeof input.contactPhone === 'string' ? input.contactPhone.trim() : '';
  const mobilePhone =
    typeof input.mobilePhone === 'string' ? input.mobilePhone.trim() : '';

  if (!fullName) errors.push('fullNameRequired');
  if (!username) errors.push('usernameRequired');
  if (!email) errors.push('emailRequired');
  else if (!EMAIL_PATTERN.test(email)) errors.push('emailInvalid');
  if (requirePassword && !password) errors.push('passwordRequired');
  if (password) errors.push(...validatePasswordPolicy(password));
  if (roles.length === 0) errors.push('rolesRequired');
  if (!validateRolesForCustomer(customerId, roles)) errors.push('rolesInvalidForCustomer');
  if (customerId && !findCustomerById(customerId)) errors.push('customerInvalid');

  const emailOwner = findUserByEmail(email);
  if (emailOwner && emailOwner.id !== existingUser?.id) errors.push('emailTaken');
  const usernameOwner = findUserByUsername(username);
  if (usernameOwner && usernameOwner.id !== existingUser?.id) errors.push('usernameTaken');

  return {
    errors,
    value: {
      fullName,
      username,
      email,
      password,
      roles,
      customerId,
      language,
      contactPhone,
      mobilePhone,
    },
  };
}

export { findCustomerById, listCustomers };

export function findUserByEmail(email) {
  const data = readUsersFile();
  return data.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function findUserByUsername(username) {
  const data = readUsersFile();
  const normalized = username.trim().toLowerCase();
  return data.users.find((user) => user.username?.toLowerCase() === normalized) ?? null;
}

export function findUserById(id) {
  const data = readUsersFile();
  return data.users.find((user) => user.id === id) ?? null;
}

export function listUsers() {
  const data = readUsersFile();
  return data.users.map((user) => toPublicUser(user));
}

export function isUserActive(user) {
  return normalizeUserStatus(user?.status) === 'active';
}

export function toPublicUser(user) {
  const profile = withProfileDefaults(user);
  const roles = normalizeRoles(user);
  const customer = findCustomerById(user.customerId);

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    roles,
    role: roles[0] ?? 'stenotypist',
    permissions: getPermissionsForRoles(roles),
    contactPhone: profile.contactPhone,
    mobilePhone: profile.mobilePhone,
    language: profile.language,
    autoRefresh: profile.autoRefresh,
    status: normalizeUserStatus(user.status),
    customerId: user.customerId ?? null,
    customerName: customer?.name ?? null,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

export function changeUserPassword(userId, currentPassword, newPassword) {
  const errors = [];
  const current = typeof currentPassword === 'string' ? currentPassword : '';
  const next = typeof newPassword === 'string' ? newPassword : '';

  if (!current) errors.push('currentPasswordRequired');
  if (!next) errors.push('newPasswordRequired');

  const data = readUsersFile();
  const index = data.users.findIndex((user) => user.id === userId);
  if (index === -1) {
    return { errors: ['userNotFound'] };
  }

  const user = data.users[index];
  if (current && !verifyPassword(current, user.passwordHash)) {
    errors.push('currentPasswordIncorrect');
  }

  if (errors.length > 0) {
    return { errors };
  }

  const result = buildPasswordUpdate(user, next, hashPassword, verifyPassword);
  if (result.errors) {
    return { errors: result.errors };
  }

  data.users[index] = {
    ...user,
    ...result.updates,
  };
  writeUsersFile(data);
  return { user: toPublicUser(data.users[index]) };
}

export async function resetUserPasswordWithToken(token, newPassword) {
  const errors = [];
  const next = typeof newPassword === 'string' ? newPassword : '';
  if (!next) errors.push('newPasswordRequired');

  const resetEntry = await consumePasswordResetToken(token);
  if (!resetEntry) errors.push('resetTokenInvalid');

  if (errors.length > 0) {
    return { errors };
  }

  const data = readUsersFile();
  const index = data.users.findIndex((user) => user.id === resetEntry.userId);
  if (index === -1) {
    return { errors: ['userNotFound'] };
  }

  const user = data.users[index];
  const result = buildPasswordUpdate(user, next, hashPassword, verifyPassword);
  if (result.errors) {
    return { errors: result.errors };
  }

  data.users[index] = {
    ...user,
    ...result.updates,
  };
  writeUsersFile(data);
  return { user: toPublicUser(data.users[index]) };
}

export async function requestPasswordResetForEmail(email) {
  const user = findUserByEmail(email);
  if (!user || !isUserActive(user)) {
    return { success: true };
  }

  const token = await createPasswordResetToken(user.id);
  return { success: true, token, email: user.email };
}

export async function validatePasswordResetToken(token) {
  const entry = await findPasswordResetToken(token);
  if (!entry) return { valid: false };
  const user = findUserById(entry.userId);
  if (!user) return { valid: false };
  return { valid: true, email: user.email };
}

export function createUser(input) {
  const { errors, value } = validateUserInput(input, { requirePassword: true });
  if (errors.length > 0) {
    return { errors };
  }

  const data = readUsersFile();
  const pwdResult = buildPasswordUpdate(
    { passwordHash: null, passwordHistory: [], passwordChangedAt: null },
    value.password,
    hashPassword,
    () => false,
  );
  if (pwdResult.errors) {
    return { errors: pwdResult.errors };
  }

  const user = {
    id: generateUserId(),
    email: value.email,
    username: value.username,
    passwordHash: pwdResult.updates.passwordHash,
    passwordHistory: [],
    passwordChangedAt: pwdResult.updates.passwordChangedAt,
    fullName: value.fullName,
    roles: value.roles,
    contactPhone: value.contactPhone,
    mobilePhone: value.mobilePhone,
    language: value.language,
    autoRefresh: false,
    status: 'active',
    customerId: value.customerId,
    mustChangePassword: true,
    mfaEnabled: true,
    totpSecret: generateTotpSecret(),
    createdAt: new Date().toISOString(),
  };

  data.users.push(user);
  writeUsersFile(data);
  return {
    user: toPublicUser(user),
    // Server-only enrollment payload (never send totpSecret to the browser).
    enrollment: {
      totpSecret: user.totpSecret,
      temporaryPassword: value.password,
    },
  };
}

export function updateUser(userId, input) {
  const data = readUsersFile();
  const index = data.users.findIndex((user) => user.id === userId);
  if (index === -1) {
    return { errors: ['userNotFound'] };
  }

  const current = data.users[index];
  const { errors, value } = validateUserInput(input, {
    requirePassword: false,
    existingUser: current,
  });
  if (errors.length > 0) {
    return { errors };
  }

  const password =
    typeof input.password === 'string' && input.password.trim()
      ? input.password
      : null;

  const next = {
    ...current,
    fullName: value.fullName,
    username: value.username,
    email: value.email,
    roles: value.roles,
    contactPhone: value.contactPhone,
    mobilePhone: value.mobilePhone,
    language: value.language,
    customerId: value.customerId,
  };

  if (password) {
    const pwdResult = buildPasswordUpdate(current, password, hashPassword, verifyPassword);
    if (pwdResult.errors) {
      return { errors: pwdResult.errors };
    }
    Object.assign(next, pwdResult.updates, { mustChangePassword: true });
  } else {
    next.mustChangePassword = current.mustChangePassword;
  }

  data.users[index] = next;
  writeUsersFile(data);
  return { user: toPublicUser(next) };
}

export function deleteUser(userId) {
  const data = readUsersFile();
  const index = data.users.findIndex((user) => user.id === userId);
  if (index === -1) {
    return { errors: ['userNotFound'] };
  }

  if (userHasSystemRecords(userId)) {
    return { errors: ['userHasRecords'] };
  }

  const [removed] = data.users.splice(index, 1);
  writeUsersFile(data);
  deleteStenotypistAssetsForUser(userId);
  return { user: toPublicUser(removed) };
}

export function updateUserStatus(userId, status) {
  const data = readUsersFile();
  const index = data.users.findIndex((user) => user.id === userId);
  if (index === -1) {
    return null;
  }

  const nextStatus = normalizeUserStatus(status);
  data.users[index] = {
    ...data.users[index],
    status: nextStatus,
  };
  writeUsersFile(data);
  return toPublicUser(data.users[index]);
}

export function updateUserProfile(userId, updates) {
  const result = updateAccountProfile(userId, updates);
  if (result.errors) {
    return null;
  }
  return result.user;
}

export function updateAccountProfile(userId, updates) {
  const data = readUsersFile();
  const index = data.users.findIndex((user) => user.id === userId);
  if (index === -1) {
    return { errors: ['userNotFound'] };
  }

  const current = data.users[index];
  const fullName =
    updates.fullName !== undefined
      ? typeof updates.fullName === 'string'
        ? updates.fullName.trim()
        : ''
      : current.fullName;
  const username =
    updates.username !== undefined
      ? typeof updates.username === 'string'
        ? updates.username.trim()
        : ''
      : current.username;
  const email =
    updates.email !== undefined
      ? typeof updates.email === 'string'
        ? updates.email.trim()
        : ''
      : current.email;
  const contactPhone =
    updates.contactPhone !== undefined
      ? typeof updates.contactPhone === 'string'
        ? updates.contactPhone.trim()
        : ''
      : current.contactPhone;
  const mobilePhone =
    updates.mobilePhone !== undefined
      ? typeof updates.mobilePhone === 'string'
        ? updates.mobilePhone.trim()
        : ''
      : current.mobilePhone;

  const errors = [];
  if (!fullName) errors.push('fullNameRequired');
  if (!username) errors.push('usernameRequired');
  if (!email) errors.push('emailRequired');
  else if (!EMAIL_PATTERN.test(email)) errors.push('emailInvalid');

  const roles = normalizeRoles(current);
  if (roles.includes('stenotypist') && !mobilePhone) {
    errors.push('mobilePhoneRequired');
  }

  const emailOwner = findUserByEmail(email);
  if (emailOwner && emailOwner.id !== userId) errors.push('emailTaken');
  const usernameOwner = findUserByUsername(username);
  if (usernameOwner && usernameOwner.id !== userId) errors.push('usernameTaken');

  if (errors.length > 0) {
    return { errors };
  }

  const oldEmail = current.email;
  const emailChanged = email.toLowerCase() !== oldEmail.toLowerCase();

  const next = {
    ...current,
    fullName,
    username,
    email,
    contactPhone,
    mobilePhone,
    language: updates.language === 'el' ? 'el' : updates.language === 'en' ? 'en' : current.language,
    autoRefresh:
      updates.autoRefresh !== undefined ? Boolean(updates.autoRefresh) : current.autoRefresh,
  };

  data.users[index] = next;
  writeUsersFile(data);

  return {
    user: toPublicUser(next),
    emailChanged,
    oldEmail: emailChanged ? oldEmail : null,
    newEmail: emailChanged ? email : null,
  };
}

export function getUserIdFromToken(token) {
  return getUserIdFromAuthToken(token);
}
