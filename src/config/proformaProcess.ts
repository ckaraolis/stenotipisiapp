import type { TranslationKey } from '../i18n/translations';
import type { ProformaProcessItemType } from '../types/proformaProcess';

export const PROFORMA_PROCESS_ITEM_TYPE_LABEL_KEYS: Record<ProformaProcessItemType, TranslationKey> =
  {
    stenotyping: 'proformaProcessTypeStenotyping',
    travelling: 'proformaProcessTypeTravelling',
  };

export function proformaProcessTypeLabelKey(type: ProformaProcessItemType | string): TranslationKey {
  if (type === 'stenotyping' || type === 'travelling') {
    return PROFORMA_PROCESS_ITEM_TYPE_LABEL_KEYS[type];
  }
  return 'proformaProcessTypeStenotyping';
}

/** §3.3 — Job duration in decimal hours (3 d.p.) from administrator start/end times. */
export function computeJobDurationHours(startTime: string, endTime: string): number | null {
  if (!startTime || !endTime) return null;
  const startMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(startTime.trim());
  const endMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(endTime.trim());
  if (!startMatch || !endMatch) return null;

  const startMinutes = Number(startMatch[1]) * 60 + Number(startMatch[2]);
  let endMinutes = Number(endMatch[1]) * 60 + Number(endMatch[2]);
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  const hours = (endMinutes - startMinutes) / 60;
  return Math.round(hours * 1000) / 1000;
}

export function formatJobDurationHours(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  return value.toFixed(3);
}

/** §3.3 — Line total for stenotyping (duration × rate) or travelling charges. */
export function computeStenotypingLineTotal(durationHours: number, hourlyRate: number): number {
  return Math.round(durationHours * hourlyRate * 100) / 100;
}

export function formatProformaProcessLineTotal(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

export function formatProformaProcessDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return date;
  return `${match[3]}/${match[2]}/${match[1].slice(-2)}`;
}

export function formatProjectLabel(fields: {
  projectField1?: string;
  projectField2?: string;
  projectField3?: string;
  projectField4?: string;
}): string {
  const parts = [
    fields.projectField1,
    fields.projectField2,
    fields.projectField3,
    fields.projectField4,
  ].filter((part) => part?.trim());
  return parts.length > 0 ? parts.join(' + ') : '—';
}

export function parseProformaProcessError(
  raw: string,
  t: (key: TranslationKey) => string,
): string {
  try {
    const parsed = JSON.parse(raw) as { errors?: string[] };
    const code = parsed.errors?.[0];
    if (!code) return t('proformaProcessLoadError');
    const key = code as TranslationKey;
    const translated = t(key);
    return translated === key ? t('proformaProcessLoadError') : translated;
  } catch {
    return t('proformaProcessLoadError');
  }
}
