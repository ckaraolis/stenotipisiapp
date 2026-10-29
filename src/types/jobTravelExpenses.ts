export type TravelExpenseStatus = 'pending' | 'approved' | 'rejected';

export interface JobTravelExpenseRecord {
  id: string;
  jobId: string;
  jobNumber: string;
  jobDate: string;
  stenotypistUserId: string;
  stenotypistFullName: string;
  stenotypistUsername: string;
  projectDistrictId: string;
  projectDistrictName: string;
  projectDistrictAlias: string;
  customerAlias: string;
  projectLabel: string;
  amount: number;
  status: TravelExpenseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface JobTravelExpenseCandidate {
  id: string;
  fullName: string;
  username: string;
}

export interface FetchJobTravelExpenseParams {
  stenotypistUserId?: string;
  status?: TravelExpenseStatus | '';
  dateFrom?: string;
  dateTo?: string;
}
