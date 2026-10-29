import type { TranslationKey } from '../i18n/translations';

/** §5.1 — Default penalty settings. */
export const DEFAULT_PENALTY_GRACE_PERIOD_HOURS = 48;
export const DEFAULT_PENALTY_BASE_AMOUNT = 30;
export const DEFAULT_PENALTY_EXTRA_PER_HOUR = 2;

export function formatPenaltyGracePeriodHours(value: number): string {
  return String(value);
}

export function formatPenaltyCurrency(value: number): string {
  return `€${value.toFixed(2)}`;
}

export function parsePenaltyConfigurationError(
  raw: string,
  t: (key: TranslationKey) => string,
): string {
  try {
    const parsed = JSON.parse(raw) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors
        .map((code) => {
          const key = code as TranslationKey;
          const translated = t(key);
          return translated === key ? t('penaltyConfigurationSaveError') : translated;
        })
        .join(' ');
    }
  } catch {
    // ignore
  }
  return t('penaltyConfigurationSaveError');
}

export function parsePenaltyConfigurationDeleteError(
  raw: string,
  t: (key: TranslationKey) => string,
): string {
  try {
    const parsed = JSON.parse(raw) as { errors?: string[] };
    const code = parsed.errors?.[0];
    if (!code) return t('penaltyConfigurationDeleteError');
    const key = code as TranslationKey;
    const translated = t(key);
    if (translated === key) {
      return t('penaltyConfigurationDeleteError');
    }
    return translated;
  } catch {
    return t('penaltyConfigurationDeleteError');
  }
}
