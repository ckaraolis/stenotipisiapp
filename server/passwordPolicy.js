/**
 * Global password security policy.
 * Adjust these values to change enforcement application-wide (no UI required).
 */
export const PASSWORD_POLICY = {
  validityDays: 180,
  noRepeatDays: 360,
  minLength: 6,
  requireUppercase: true,
  requireNumber: true,
  requireSpecialChar: true,
};

/** Default password for the development seed user (meets policy). */
export const SEED_PASSWORD = 'Xka123!';

/**
 * Generate a one-time password that meets PASSWORD_POLICY.
 * Used when admins create users without choosing a password.
 */
export function generateTemporaryPassword(length = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;

  const pick = (alphabet) => alphabet[Math.floor(Math.random() * alphabet.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  while (chars.length < Math.max(length, PASSWORD_POLICY.minLength)) {
    chars.push(pick(all));
  }
  // Shuffle
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const SPECIAL_CHAR_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

const DAY_MS = 24 * 60 * 60 * 1000;

export function validatePasswordPolicy(password) {
  const errors = [];
  const value = typeof password === 'string' ? password : '';

  if (!value) {
    errors.push('passwordRequired');
    return errors;
  }

  if (value.length < PASSWORD_POLICY.minLength) {
    errors.push('passwordTooShort');
  }
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(value)) {
    errors.push('passwordMissingUppercase');
  }
  if (PASSWORD_POLICY.requireNumber && !/\d/.test(value)) {
    errors.push('passwordMissingNumber');
  }
  if (PASSWORD_POLICY.requireSpecialChar && !SPECIAL_CHAR_PATTERN.test(value)) {
    errors.push('passwordMissingSpecialChar');
  }

  return errors;
}

export function isPasswordExpired(user) {
  if (!user?.passwordChangedAt) {
    return false;
  }
  const changedAt = new Date(user.passwordChangedAt).getTime();
  if (Number.isNaN(changedAt)) {
    return false;
  }
  return Date.now() - changedAt > PASSWORD_POLICY.validityDays * DAY_MS;
}

export function isPasswordInRecentHistory(user, password, verifyPassword) {
  const cutoff = Date.now() - PASSWORD_POLICY.noRepeatDays * DAY_MS;

  if (user?.passwordHash && verifyPassword(password, user.passwordHash)) {
    return true;
  }

  for (const entry of user?.passwordHistory ?? []) {
    const changedAt = new Date(entry.changedAt).getTime();
    if (Number.isNaN(changedAt) || changedAt < cutoff) {
      continue;
    }
    if (entry.hash && verifyPassword(password, entry.hash)) {
      return true;
    }
  }

  return false;
}

function prunePasswordHistory(history, nowIso) {
  const cutoff = Date.now() - PASSWORD_POLICY.noRepeatDays * DAY_MS;
  return (history ?? []).filter((entry) => {
    const changedAt = new Date(entry.changedAt).getTime();
    return !Number.isNaN(changedAt) && changedAt >= cutoff;
  });
}

export function buildPasswordUpdate(user, newPassword, hashPassword, verifyPassword) {
  const errors = validatePasswordPolicy(newPassword);
  if (errors.length > 0) {
    return { errors };
  }

  if (isPasswordInRecentHistory(user, newPassword, verifyPassword)) {
    return { errors: ['passwordRecentlyUsed'] };
  }

  const now = new Date().toISOString();
  const history = prunePasswordHistory(user?.passwordHistory ?? [], now);

  if (user?.passwordHash) {
    history.push({
      hash: user.passwordHash,
      changedAt: user.passwordChangedAt ?? now,
    });
  }

  return {
    updates: {
      passwordHash: hashPassword(newPassword),
      passwordHistory: history,
      passwordChangedAt: now,
      mustChangePassword: false,
    },
  };
}

export function ensurePasswordExpiryEnforced(user) {
  if (!user) return user;
  if (isPasswordExpired(user) && !user.mustChangePassword) {
    return { ...user, mustChangePassword: true };
  }
  return user;
}
