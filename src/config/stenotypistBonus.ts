import type { TranslationKey } from '../i18n/translations';

/** §4.1 — Default bonus settings. */
export const DEFAULT_BONUS_BASE_HOURS = 40;
export const DEFAULT_BONUS_PER_EXTRA_HOUR = 20;

export function formatBonusConfigurationStenotypistLabel(
  fullName: string,
  username: string,
): string {
  if (fullName && username) return `${fullName} (${username})`;
  return fullName || username || '—';
}

export function formatBonusBaseHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

export function formatBonusPerExtraHour(value: number): string {
  return `€${value.toFixed(2)}`;
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
