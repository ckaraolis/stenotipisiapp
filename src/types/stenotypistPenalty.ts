export interface StenotypistPenaltyConfigurationRecord {
  id: string;
  stenotypistUserId: string;
  stenotypistFullName: string;
  stenotypistUsername: string;
  targetHoursBeforeDeadline: number;
  penaltyPerHourLate: number;
  validFrom: string;
  createdAt: string;
  updatedAt: string;
}

export interface StenotypistPenaltyConfigurationPayload {
  stenotypistUserId: string;
  targetHoursBeforeDeadline: number | string;
  penaltyPerHourLate: number | string;
  validFrom: string;
}

export interface StenotypistPenaltyCandidate {
  id: string;
  fullName: string;
  username: string;
}

export interface StenotypistPenaltyConfigurationFilters {
  stenotypistUserId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type StenotypistPenaltyImportRow = Record<string, unknown>;

export interface StenotypistPenaltyImportError {
  row: number;
  message: string;
  detail?: string;
}

export interface StenotypistPenaltyImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: StenotypistPenaltyImportError[];
}
