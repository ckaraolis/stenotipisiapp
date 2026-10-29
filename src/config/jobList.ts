import type { JobPhase, JobStatus } from '../types/job';
import type { JobRecord } from '../types/jobRecord';
import { getPhaseForJobStatus } from './job';

export {
  getJobListCapabilities,
  getJobListInlineActions,
  isCoordinatorJobListView,
  isCoordinatorJobDetailsView,
  isCustomerOrganisationJobListView,
  isDistrictAdminJobListView,
  isDistrictAdminJobDetailsView,
  isManagerJobListView,
  isManagerJobDetailsView,
  isStenotypistJobListView,
  isStenotypistJobDetailsView,
  isCustomerOrganisationJobDetailsView,
  canAccessJobListModule,
  filterJobsForJobListView,
  filterJobsForStenotypistJobList,
  hasFullJobDetailsFormAccess,
  isRestrictedJobDetailsFormView,
  type JobListActorContext,
  type JobListInlineAction,
} from './jobListPermissions';

export const JOB_LIST_PAGE_SIZE = 20;
export function formatJobCustomerLabel(job: JobRecord): string {
  if (job.customerAlias && job.customerName) {
    return `${job.customerAlias} – ${job.customerName}`;
  }
  return job.customerName || job.customerAlias || '—';
}

export function formatJobProjectLabel(job: JobRecord): string {
  const parts = [job.projectField1, job.projectField2, job.projectField3, job.projectField4].filter(
    Boolean,
  );
  if (parts.length > 0) {
    return parts.join(' - ');
  }
  return job.projectNumber || '—';
}

export function formatJobStenotypistLabel(job: JobRecord): string {
  if (job.stenotypistUsername && job.stenotypistName) {
    return `${job.stenotypistUsername} – ${job.stenotypistName}`;
  }
  return job.stenotypistName || job.stenotypistUsername || '—';
}

export function getDefaultJobDateRange(jobs: JobRecord[]): { from: string; to: string } {
  const eligible = jobs.filter((job) => job.status !== 'published');
  if (eligible.length === 0) {
    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    return { from: iso, to: iso };
  }

  const dates = eligible.map((job) => job.date).sort();
  return { from: dates[0], to: dates[dates.length - 1] };
}

export function filterJobListRows(
  jobs: JobRecord[],
  filters: {
    dateFrom: string;
    dateTo: string;
    customerId: string;
    projectId: string;
    phase: string;
    status: string;
    stenotypistUserId: string;
    search: string;
  },
): JobRecord[] {
  const query = filters.search.trim().toLowerCase();

  return jobs.filter((job) => {
    if (job.date < filters.dateFrom || job.date > filters.dateTo) return false;
    if (filters.customerId && job.customerId !== filters.customerId) return false;
    if (filters.projectId && job.projectId !== filters.projectId) return false;
    if (filters.stenotypistUserId && job.stenotypistUserId !== filters.stenotypistUserId) return false;

    if (filters.phase) {
      const phase = getPhaseForJobStatus(job.status);
      if (phase !== filters.phase) return false;
    }

    if (filters.status && job.status !== filters.status) return false;

    if (!query) return true;

    return (
      job.jobNumber.toLowerCase().includes(query) ||
      formatJobCustomerLabel(job).toLowerCase().includes(query) ||
      formatJobProjectLabel(job).toLowerCase().includes(query) ||
      formatJobStenotypistLabel(job).toLowerCase().includes(query) ||
      job.locationDetails.toLowerCase().includes(query)
    );
  });
}

export function sortJobListRows(jobs: JobRecord[]): JobRecord[] {
  return [...jobs].sort((a, b) =>
    a.jobNumber.localeCompare(b.jobNumber, undefined, { numeric: true }),
  );
}

export function getJobListFilterOptions(jobs: JobRecord[]) {
  const customers = new Map<string, string>();
  const projects = new Map<string, string>();
  const stenotypists = new Map<string, string>();

  for (const job of jobs) {
    if (job.customerId) {
      customers.set(job.customerId, formatJobCustomerLabel(job));
    }
    if (job.projectId) {
      projects.set(job.projectId, formatJobProjectLabel(job));
    }
    if (job.stenotypistUserId) {
      stenotypists.set(job.stenotypistUserId, formatJobStenotypistLabel(job));
    }
  }

  return {
    customers: [...customers.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    projects: [...projects.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    stenotypists: [...stenotypists.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    phases: ['requested', 'scheduled', 'in_progress', 'completed', 'cancelled'] as JobPhase[],
    statuses: [
      'new',
      'approved',
      'pending',
      'assigned',
      'finished',
      'edited',
      'in_review',
      'reviewed',
      'published',
      'reconciled',
      'invoiced',
      'rejected',
      'deleted',
    ] as JobStatus[],
  };
}
