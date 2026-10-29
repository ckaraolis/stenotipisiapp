export interface TravelExpenseConfigurationRecord {
  id: string;
  stenotypistUserId: string;
  stenotypistFullName: string;
  stenotypistUsername: string;
  districtId: string;
  districtName: string;
  districtAlias: string;
  amount: number;
  validFrom: string;
  createdAt: string;
  updatedAt: string;
}

export interface TravelExpenseConfigurationPayload {
  stenotypistUserId: string;
  districtId: string;
  amount: number | string;
  validFrom: string;
}

export interface TravelExpenseCandidate {
  id: string;
  fullName: string;
  username: string;
}

export interface TravelExpenseConfigurationFilters {
  stenotypistUserId?: string;
  districtId?: string;
  dateFrom?: string;
  dateTo?: string;
}
