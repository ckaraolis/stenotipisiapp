export interface StenotypistPenaltyConfigurationRecord {
  id: string;
  gracePeriodHours: number;
  basePenalty: number;
  extraPenaltyPerHour: number;
  validFrom: string;
  createdAt: string;
  updatedAt: string;
}

export interface StenotypistPenaltyConfigurationPayload {
  gracePeriodHours: number | string;
  basePenalty: number | string;
  extraPenaltyPerHour: number | string;
  validFrom: string;
}

export interface StenotypistPenaltyConfigurationFilters {
  dateFrom?: string;
  dateTo?: string;
}
