import type { TranslationKey } from '../i18n/translations';

/** §4.1 — Default bonus thresholds (ASTRAEA H1/H2 style). */
export const DEFAULT_BONUS_H1 = 52;
export const DEFAULT_BONUS_H2 = 72;
export const DEFAULT_BONUS_H1_EUR = 20;
export const DEFAULT_BONUS_H2_EUR = 20;

/** @deprecated Prefer DEFAULT_BONUS_H1 */
export const DEFAULT_BONUS_BASE_HOURS = DEFAULT_BONUS_H1;
/** @deprecated Prefer DEFAULT_BONUS_H1_EUR */
export const DEFAULT_BONUS_PER_EXTRA_HOUR = DEFAULT_BONUS_H1_EUR;

export function formatBonusConfigurationStenotypistLabel(
  fullName: string,
  username: string,
): string {
  if (fullName && username) return `${fullName} (${username})`;
  return fullName || username || '—';
}

export function formatBonusHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

export function formatBonusBaseHours(value: number): string {
  return formatBonusHours(value);
}

export function formatBonusCurrency(value: number): string {
  return value.toFixed(2);
}

export function formatBonusPerExtraHour(value: number): string {
  return `€${formatBonusCurrency(value)}`;
}

export function parseBonusConfigurationError(
  raw: string,
  t: (key: TranslationKey) => string,
): string {
  try {
    const parsed = JSON.parse(raw) as { errors?: string[] };
    const code = parsed.errors?.[0];
    if (!code) return t('bonusConfigurationSaveError');
    const key = code as TranslationKey;
    const translated = t(key);
    if (translated === key) {
      return t('bonusConfigurationSaveError');
    }
    return translated;
  } catch {
    return t('bonusConfigurationSaveError');
  }
}

export function parseBonusConfigurationDeleteError(
  raw: string,
  t: (key: TranslationKey) => string,
): string {
  try {
    const parsed = JSON.parse(raw) as { errors?: string[] };
    const code = parsed.errors?.[0];
    if (!code) return t('bonusConfigurationDeleteError');
    const key = code as TranslationKey;
    const translated = t(key);
    if (translated === key) {
      return t('bonusConfigurationDeleteError');
    }
    return translated;
  } catch {
    return t('bonusConfigurationDeleteError');
  }
}
