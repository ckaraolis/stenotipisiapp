import type { AllocationJobStatus } from '../data/mockJobAllocation';

/** Matrix schedule cell colour groups per job workflow status (§4.9.2.6). */
export function mapAllocationJobStatus(jobStatus: string): AllocationJobStatus {
  if (jobStatus === 'pending') return 'pending';
  if (jobStatus === 'assigned') return 'assigned';
  if (
    jobStatus === 'finished' ||
    jobStatus === 'edited' ||
    jobStatus === 'in_review' ||
    jobStatus === 'reviewed'
  ) {
    return 'in-progress';
  }
  if (jobStatus === 'published' || jobStatus === 'reconciled' || jobStatus === 'invoiced') {
    return 'completed';
  }
  return 'assigned';
}

export const MATRIX_DRAGGABLE_JOB_STATUSES = new Set(['approved', 'pending', 'assigned']);

export const MATRIX_UNASSIGNABLE_JOB_STATUSES = new Set(['pending', 'assigned']);
