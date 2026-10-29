import type { TranslationKey } from '../i18n/translations';
import { jobStatusLabelKey } from './job';
import { normalizeRoles } from './roles';
import type { UserRole } from './roles';
import type { JobStatus } from '../types/job';

export function canEditTranscriptDetails(roles: UserRole[] | UserRole | null | undefined): boolean {
  const normalized = normalizeRoles(roles);
  return normalized.includes('super_admin') || normalized.includes('manager');
}

function slaToHours(sla: string): number {
  const match = sla.trim().match(/^(\d+)\s*day/i);
  if (!match) return 24;
  return Number(match[1]) * 24;
}

function parseTimeToMinutes(value: string): number | null {
  if (!value.includes(':')) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

/** §2.2 — Remaining minutes until job end + SLA (negative = overdue). */
export function computeTranscriptDeadlineMinutes(
  jobDate: string,
  jobEndTime: string,
  serviceLevelAgreement: string,
  expedite = false,
): number | null {
  const minutes = parseTimeToMinutes(jobEndTime);
  if (minutes === null || !jobDate) return null;

  let sla = serviceLevelAgreement || '1 day';
  if (expedite) {
    const match = sla.match(/^(\d+)/);
    if (match) {
      const days = Math.max(1, Math.ceil(Number(match[1]) / 2));
      sla = `${days} day${days === 1 ? '' : 's'}`;
    }
  }

  const endDateTime = new Date(`${jobDate}T12:00:00`);
  endDateTime.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  const deadlineMs = endDateTime.getTime() + slaToHours(sla) * 60 * 60 * 1000;
  return Math.round((deadlineMs - Date.now()) / (60 * 1000));
}

export function formatTranscriptDeadline(
  deadlineMinutes: number | null,
  t: (key: TranslationKey) => string,
): string {
  if (deadlineMinutes === null) return '—';
  const absMinutes = Math.abs(deadlineMinutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
  const duration = parts.join(' ');
  if (deadlineMinutes < 0) {
    return t('transcriptDeadlineOverdue').replace('{duration}', duration);
  }
  return t('transcriptDeadlineRemaining').replace('{duration}', duration);
}

/** §2.5 — Report deadline as decimal hours; negative when overdue. */
export function formatTranscriptReportDeadline(deadlineMinutes: number | null): string {
  if (deadlineMinutes === null) return '—';
  const hours = Math.round((deadlineMinutes / 60) * 10) / 10;
  return `${hours} ${hours === 1 || hours === -1 ? 'hour' : 'hours'}`;
}

export function formatTranscriptJobStatus(
  jobStatus: string,
  t: (key: TranslationKey) => string,
): string {
  if (!jobStatus) return '—';
  const key = jobStatusLabelKey(jobStatus as JobStatus);
  return t(key);
}
