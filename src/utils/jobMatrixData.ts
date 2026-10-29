import {
  formatAllocationDateKey,
  mockMatrixPendingJobs,
  mockMatrixStaff,
  type AllocationJobStatus,
  type MatrixCellEntry,
  type MatrixPendingJob,
  type MatrixStaffRow,
} from '../data/mockJobAllocation';
import type { JobRecord } from '../types/jobRecord';

const SCHEDULE_JOB_STATUSES = new Set([
  'new',
  'approved',
  'pending',
  'assigned',
  'finished',
  'edited',
  'in_review',
  'reviewed',
  'published',
]);

function formatJobTitle(job: JobRecord): string {
  const location = job.districtAlias || job.locationDetails || '—';
  const customer = job.customerAlias || job.customerName || '—';
  return `${customer} - ${location} - ${job.jobNumber}`;
}

function mapJobCellStatus(status: JobRecord['status']): AllocationJobStatus {
  if (status === 'pending') return 'pending';
  if (status === 'assigned') return 'assigned';
  if (status === 'finished' || status === 'edited' || status === 'in_review' || status === 'reviewed') {
    return 'in-progress';
  }
  if (status === 'published' || status === 'reconciled' || status === 'invoiced') {
    return 'completed';
  }
  return 'assigned';
}

function isUnassignedJob(job: JobRecord): boolean {
  if (job.status === 'deleted' || job.status === 'rejected') return false;
  return !job.stenotypistUserId?.trim();
}

function isScheduleJob(job: JobRecord): boolean {
  if (!job.stenotypistUserId?.trim()) return false;
  return SCHEDULE_JOB_STATUSES.has(job.status);
}

function cloneStaffWithoutJobs(row: MatrixStaffRow): MatrixStaffRow {
  const schedule: Record<string, MatrixCellEntry[]> = {};
  for (const [date, entries] of Object.entries(row.schedule)) {
    const kept = entries.filter((entry) => entry.kind !== 'job');
    if (kept.length > 0) {
      schedule[date] = kept;
    }
  }
  return {
    st: row.st,
    metrics: { ...row.metrics },
    schedule,
  };
}

function stenotypistKey(job: JobRecord): string {
  return (job.stenotypistUsername || job.stenotypistName || '').trim().toUpperCase();
}

export function buildMatrixStaffFromJobs(
  jobs: JobRecord[],
  scheduleDays: Date[],
): MatrixStaffRow[] {
  const visibleDateKeys = new Set(scheduleDays.map((day) => formatAllocationDateKey(day)));
  const staffMap = new Map<string, MatrixStaffRow>();

  for (const row of mockMatrixStaff) {
    staffMap.set(row.st, cloneStaffWithoutJobs(row));
  }

  for (const job of jobs) {
    if (!isScheduleJob(job) || !visibleDateKeys.has(job.date)) continue;

    const alias = stenotypistKey(job);
    if (!alias) continue;

    let row = staffMap.get(alias);
    if (!row) {
      row = {
        st: alias,
        metrics: { m1: '0', m2: '0', m3: '0' },
        schedule: {},
      };
      staffMap.set(alias, row);
    }

    const entry: MatrixCellEntry = {
      kind: 'job',
      id: job.id,
      status: mapJobCellStatus(job.status),
      jobStatus: job.status,
      title: formatJobTitle(job),
      customerAlias: job.customerAlias || job.customerName || '—',
      district: job.districtAlias || job.districtName || job.locationDetails || '—',
      projectField1: job.projectField1 || '—',
      projectField2: job.projectField2 || '—',
      projectField3: job.projectField3 || '—',
      time: job.time || '—',
    };

    const existing = row.schedule[job.date] ?? [];
    const withoutSame = existing.filter((item) => !(item.kind === 'job' && item.id === job.id));
    row.schedule[job.date] = [...withoutSame, entry];
  }

  const hasApiJobs = jobs.some(
    (job) => isScheduleJob(job) && visibleDateKeys.has(job.date),
  );

  if (!hasApiJobs) {
    return mockMatrixStaff.map((row) => ({
      st: row.st,
      metrics: { ...row.metrics },
      schedule: Object.fromEntries(
        Object.entries(row.schedule).map(([date, entries]) => [date, [...entries]]),
      ),
    }));
  }

  return Array.from(staffMap.values()).sort((a, b) => a.st.localeCompare(b.st));
}

export function buildUnassignedJobsFromRecords(jobs: JobRecord[]): MatrixPendingJob[] {
  const fromApi = jobs
    .filter(isUnassignedJob)
    .map((job) => ({
      id: job.id,
      customer: job.customerAlias || job.customerName,
      location: job.districtAlias || job.districtName || job.locationDetails,
      customerAlias: job.customerAlias || job.customerName || '—',
      district: job.districtAlias || job.districtName || job.locationDetails || '—',
      projectField1: job.projectField1 || '—',
      projectField2: job.projectField2 || '—',
      projectField3: job.projectField3 || '—',
      title: formatJobTitle(job),
      time: job.time || '—',
      date: job.date,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

  return fromApi.length > 0 ? fromApi : mockMatrixPendingJobs;
}
