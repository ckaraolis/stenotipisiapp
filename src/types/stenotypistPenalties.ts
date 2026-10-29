export interface StenotypistPenaltiesCandidate {
  id: string;
  fullName: string;
  username: string;
}

export interface JobPenaltyRecord {
  id: string;
  jobId: string;
  jobNumber: string;
  jobDate: string;
  stenotypistUserId: string;
  stenotypistFullName: string;
  stenotypistUsername: string;
  customerAlias: string;
  projectLabel: string;
  jobEndTimeAdministrator: string;
  serviceLevel: string;
  gracePeriodHours: number;
  requiredSubmissionDateTime: string;
  actualSubmissionDateTime: string;
  delayHours: number;
  basePenalty: number;
  extraPenalty: number;
  totalPenalty: number;
}

export interface FetchJobPenaltyRecordsParams {
  stenotypistUserId?: string;
  dateFrom?: string;
  dateTo?: string;
}
