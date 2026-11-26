export interface StenotypistBonusConfigurationRecord {
  id: string;
  stenotypistUserId: string;
  stenotypistFullName: string;
  stenotypistUsername: string;
  stenotypistRoles: string[];
  h1: number;
  h2: number;
  h1BonusEur: number;
  h2BonusEur: number;
  validFrom: string;
  createdAt: string;
  updatedAt: string;
}

export interface StenotypistBonusConfigurationPayload {
  stenotypistUserId: string;
  h1: number | string;
  h2: number | string;
  h1BonusEur: number | string;
  h2BonusEur: number | string;
  validFrom: string;
}

export interface StenotypistBonusCandidate {
  id: string;
  fullName: string;
  username: string;
  roles: string[];
}

export interface StenotypistBonusConfigurationFilters {
  stenotypistUserId?: string;
  dateFrom?: string;
  dateTo?: string;
}
