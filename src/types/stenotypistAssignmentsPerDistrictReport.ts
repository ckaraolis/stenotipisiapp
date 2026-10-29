export interface AssignmentsPerDistrictColumn {
  id: string;
  name: string;
  alias: string;
}

export interface AssignmentsPerDistrictRow {
  id: string;
  alias: string;
  fullName: string;
  hoursByDistrictId: Record<string, string>;
}

export interface AssignmentsPerDistrictPagination {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export interface StenotypistAssignmentsPerDistrictReportView {
  dateFrom: string;
  dateTo: string;
  sortDirection: 'asc' | 'desc';
  districts: AssignmentsPerDistrictColumn[];
  rows: AssignmentsPerDistrictRow[];
  pagination: AssignmentsPerDistrictPagination;
}
