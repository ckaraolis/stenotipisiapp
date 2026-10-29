export interface StenotypistBonusesCandidate {
  id: string;
  fullName: string;
  username: string;
}

export interface MonthlyBonusRecord {
  id: string;
  year: number;
  month: number;
  stenotypistUserId: string;
  stenotypistFullName: string;
  stenotypistUsername: string;
  totalHours: number;
  baseHours: number;
  extraHours: number;
  bonusPerExtraHour: number;
  bonus: number;
}

export interface FetchMonthlyBonusRecordsParams {
  stenotypistUserId?: string;
  dateFrom?: string;
  dateTo?: string;
}
