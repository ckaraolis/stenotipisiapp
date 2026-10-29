/**
 * Client-side mirror of server/passwordPolicy.js for form validation.
 * Keep in sync with server configuration.
 */
export const PASSWORD_POLICY = {
  validityDays: 180,
  noRepeatDays: 360,
  minLength: 6,
  requireUppercase: true,
  requireNumber: true,
  requireSpecialChar: true,
} as const;

const SPECIAL_CHAR_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export type PasswordPolicyErrorCode =
  | 'passwordTooShort'
  | 'passwordMissingUppercase'
  | 'passwordMissingNumber'
  | 'passwordMissingSpecialChar';

export function validatePasswordPolicy(password: string): PasswordPolicyErrorCode[] {
  const errors: PasswordPolicyErrorCode[] = [];

  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push('passwordTooShort');
  }
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('passwordMissingUppercase');
  }
  if (PASSWORD_POLICY.requireNumber && !/\d/.test(password)) {
    errors.push('passwordMissingNumber');
  }
  if (PASSWORD_POLICY.requireSpecialChar && !SPECIAL_CHAR_PATTERN.test(password)) {
    errors.push('passwordMissingSpecialChar');
  }

  return errors;
}
