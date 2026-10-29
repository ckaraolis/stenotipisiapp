import type { TravellingCharges } from './customer';
import type { JobStatus } from './job';

export const JOB_RECONCILIATION_STATUS_OPTIONS = ['pending', 'correct', 'errors'] as const;

export const JOB_REJECTION_REASON_OPTIONS = [
  'scheduling_conflict',
  'resource_unavailable',
  'customer_cancelled',
  'insufficient_information',
  'other',
] as const;

export type JobReconciliationStatus = (typeof JOB_RECONCILIATION_STATUS_OPTIONS)[number];
export type JobRejectionReason = (typeof JOB_REJECTION_REASON_OPTIONS)[number];

export interface JobRecord {
  id: string;
  jobNumber: string;
  ownerUserId: string;
  ownerName: string;
  ownerUsername: string;
  projectId: string;
  projectNumber: string;
  customerId: string;
  customerName: string;
  customerAlias: string;
  projectField1: string;
  projectField2: string;
  projectField3: string;
  projectField4: string;
  projectTravellingCharges: TravellingCharges;
  date: string;
  time: string;
  stenotypistUserId: string;
  stenotypistName: string;
  stenotypistUsername: string;
  stenotypistAlias: string;
  locationDetails: string;
  districtId: string;
  districtName: string;
  districtAlias: string;
  status: JobStatus;
  remarks: string;
  expedite: boolean;
  rejectionReason: string;
  receiptNumberStenotypist: string;
  startTimeStenotypist: string;
  endTimeStenotypist: string;
  travellingChargesSystem: number;
  receiptNumberAdministrator: string;
  startTimeAdministrator: string;
  endTimeAdministrator: string;
  travellingChargesAdministrator: number;
  travellingKm: number;
  travellingKmRate: number;
  reconciliationStatus: JobReconciliationStatus;
  proformaNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobPayload {
  projectId: string;
  districtId?: string;
  date: string;
  time: string;
  stenotypistUserId?: string;
  locationDetails?: string;
  status?: JobStatus | string;
  remarks?: string;
  expedite?: boolean;
  rejectionReason?: JobRejectionReason | string;
  receiptNumberStenotypist?: string;
  startTimeStenotypist?: string;
  endTimeStenotypist?: string;
  travellingChargesSystem?: number | string;
  receiptNumberAdministrator?: string;
  startTimeAdministrator?: string;
  endTimeAdministrator?: string;
  travellingChargesAdministrator?: number | string;
  travellingKm?: number | string;
  travellingKmRate?: number | string;
  reconciliationStatus?: JobReconciliationStatus | string;
  proformaNumber?: string;
}
