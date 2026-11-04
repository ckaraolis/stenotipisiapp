/** Display calendar dates as DD/MM/YYYY across the app. Storage/API stay ISO (YYYY-MM-DD). */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
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
