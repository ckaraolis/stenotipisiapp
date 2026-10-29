export type StenotypistFinancialsReportCandidate = {
  id: string;
  fullName: string;
  username: string;
};

export type StenotypistFinancialsReportRow = {
  id: string;
  stenotypistUserId: string;
  stenotypistFullName: string;
  stenotypistUsername: string;
  bonus: number;
  penalty: number;
  travelExpenses: number;
  total: number;
  earliestJobDate: string;
};

export type StenotypistFinancialsReportTotals = {
  bonus: number;
  penalty: number;
  travelExpenses: number;
  total: number;
};

export type FetchStenotypistFinancialsReportParams = {
  stenotypistUserId?: string;
  dateFrom?: string;
  dateTo?: string;
};
