export type JobType = 'steno' | 'audio' | 'caption';

export interface SchedulingJob {
  jobNumber: string;
  owner: string;
  customer: string;
  project: string;
  date: string;
  time: string;
  stenotypist: string;
  district: string;
  phase: string;
  status: string;
  expedite: boolean;
  remarks: string;
  refJob: string;
  type: JobType;
}

export const mockSchedulingJobs: SchedulingJob[] = [];

export interface JobAllocationRow {
  jobNumber: string;
  customer: string;
  project: string;
  date: string;
  time: string;
  district: string;
  assignedTo: string;
  allocationStatus: string;
}

export const mockJobAllocations: JobAllocationRow[] = [];

export interface AvailabilityRow {
  stenotypist: string;
  district: string;
  date: string;
  from: string;
  to: string;
  status: string;
}

export const mockAvailability: AvailabilityRow[] = [];

export interface AudioReviewerRow {
  reviewer: string;
  district: string;
  date: string;
  shift: string;
  onDuty: boolean;
}

export const mockAudioReviewers: AudioReviewerRow[] = [];
