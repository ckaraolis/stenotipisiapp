/** Display calendar dates as DD/MM/YYYY across the app. Storage/API stay ISO (YYYY-MM-DD). */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const DMY_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** Format a YYYY-MM-DD (or ISO datetime) value for UI display as DD/MM/YYYY. */
export function formatDateDisplay(value: string | null | undefined): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '—';

  const match = ISO_DATE.exec(text);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** ISO YYYY-MM-DD → DD/MM/YYYY for editable inputs (empty stays empty). */
export function formatDateInputValue(value: string | null | undefined): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  const formatted = formatDateDisplay(text);
  return formatted === '—' ? '' : formatted;
}

/** Parse DD/MM/YYYY (also accepts D/M/YYYY, -, .) into ISO YYYY-MM-DD. */
export function parseDateInputValue(value: string | null | undefined): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';

  const iso = ISO_DATE.exec(text);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!isValidYmd(year, month, day)) return null;
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const dmy = DMY_DATE.exec(text);
  if (!dmy) return null;
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  const year = Number(dmy[3]);
  if (!isValidYmd(year, month, day)) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Format an ISO datetime for UI as DD/MM/YYYY HH:mm. */
export function formatDateTimeDisplay(value: string | null | undefined): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '—';

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Format an ISO datetime for UI as DD/MM/YYYY HH:mm:ss. */
export function formatDateTimeSecondsDisplay(value: string | null | undefined): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '—';

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}
