import type { JobStatus } from './job';

export const PROFORMA_PROCESS_ITEM_TYPES = ['stenotyping', 'travelling'] as const;
export type ProformaProcessItemType = (typeof PROFORMA_PROCESS_ITEM_TYPES)[number];

export interface ProformaProcessItem {
  id: string;
  type: ProformaProcessItemType;
  jobId: string;
  jobNumber: string;
  jobDate: string;
  jobStatus: JobStatus;
  customerId: string;
  customerName: string;
  projectLabel: string;
  stenotypistAlias: string;
  receiptNumber: string;
  jobDurationHours: number | null;
  hourlyRate: number | null;
  districtLabel: string;
  travellingCharges: number | null;
  lineTotal: number;
}

export interface ProformaProcessGroup {
  customerId: string;
  customerName: string;
  items: ProformaProcessItem[];
}

export interface ProformaProcessFilters {
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  stenotypistUserId?: string;
  jobStatus?: JobStatus | '';
  type?: ProformaProcessItemType | '';
}

export interface ProformaGenerationResult {
  exportId: string;
  download?: {
    json: string;
    csv: string;
  };
  proformas: Array<{
    id: string;
    proformaNumber: string;
    customerId: string;
    customerName: string;
    jobIds: string[];
  }>;
}
