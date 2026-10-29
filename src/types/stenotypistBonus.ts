export interface StenotypistBonusConfigurationRecord {
  id: string;
  stenotypistUserId: string;
  stenotypistFullName: string;
  stenotypistUsername: string;
  baseHours: number;
  bonusPerExtraHour: number;
  validFrom: string;
  createdAt: string;
  updatedAt: string;
}

export interface StenotypistBonusConfigurationPayload {
  stenotypistUserId: string;
  baseHours: number | string;
  bonusPerExtraHour: number | string;
  validFrom: string;
}

export interface StenotypistBonusCandidate {
  id: string;
  fullName: string;
  username: string;
}

export interface StenotypistBonusConfigurationFilters {
  stenotypistUserId?: string;
  dateFrom?: string;
  dateTo?: string;
}
