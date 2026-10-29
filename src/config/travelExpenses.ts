import type { TranslationKey } from '../i18n/translations';

/** §6.1 — Same-day multi-job travel in one district is handled manually by a Manager. */
export const TRAVEL_EXPENSE_SAME_DAY_MULTI_JOB_NOTE_KEY =
  'travelExpenseSameDayMultiJobNote' as const;

export function formatTravelExpenseStenotypistLabel(
  fullName: string,
  username: string,
): string {
  if (fullName && username) return `${fullName} (${username})`;
  return fullName || username || '—';
}

export function formatTravelExpenseDistrictLabel(name: string, alias: string): string {
  if (name && alias) return `${name} (${alias})`;
  return name || alias || '—';
}

export function formatTravelExpenseAmount(value: number): string {
  return `€${value.toFixed(2)}`;
}

export function parseTravelExpenseError(
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
          return translated === key ? t('travelExpenseSaveError') : translated;
        })
        .join(' ');
    }
  } catch {
    // ignore
  }
  return t('travelExpenseSaveError');
}

export function parseTravelExpenseDeleteError(
  raw: string,
  t: (key: TranslationKey) => string,
): string {
  try {
    const parsed = JSON.parse(raw) as { errors?: string[] };
    const code = parsed.errors?.[0];
    if (!code) return t('travelExpenseDeleteError');
    const key = code as TranslationKey;
    const translated = t(key);
    if (translated === key) {
      return t('travelExpenseDeleteError');
    }
    return translated;
  } catch {
    return t('travelExpenseDeleteError');
  }
}
