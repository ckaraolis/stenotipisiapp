import type { JobMatrixMetrics } from './jobMatrix';

export interface StenotypistSummaryReportRow {
  id: string;
  alias: string;
  fullName: string;
  metrics: JobMatrixMetrics;
}

export interface StenotypistSummaryReportView {
  centerDate: string;
  rows: StenotypistSummaryReportRow[];
}
