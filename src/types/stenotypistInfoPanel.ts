import type { JobMatrixMetrics } from './jobMatrix';

export type StenotypistInfoPeriod =
  | 'yesterday'
  | 'current_month'
  | 'last_30_days'
  | 'last_3_months'
  | 'last_6_months'
  | 'last_year';

export interface StenotypistInfoPersonalDictionaryEntry {
  jobId: string;
  jobNumber: string;
  date: string;
  lines: number;
}

export interface StenotypistInfoPanelView {
  stenotypistUserId: string;
  alias: string;
  fullName: string;
  email: string;
  contactPhone: string;
  mobilePhone: string;
  centerDate: string;
  period: StenotypistInfoPeriod;
  metrics: JobMatrixMetrics;
  assets: {
    laptopSerialNumber: string;
    stenotypeMachineSerialNumber: string;
    eKeyNumber: string;
    eKeyExpiryDate: string;
  };
  bonus: {
    totalBillableHours: string;
    baseHours: string;
    extraHours: string;
    bonusPerExtraHour: string;
    bonus: string;
  };
  personalDictionaryEntries: StenotypistInfoPersonalDictionaryEntry[];
  leave: {
    daysTakenCurrentYear: number;
    approvedLeaveUpcomingDays: number;
  };
  periodInfo: {
    travellingTime: string;
    travellingBilledHoursRatio: string;
    totalPagesWritten: string;
    pendingTranscriptPages: string;
    totalPagesWrittenPlusPending: string;
    pagesWrittenBilledHoursRatio: string;
    daysOut: number;
    lastDateOut: string;
    delayedTranscriptCount: number;
    delayedTranscriptBuckets: Record<string, number>;
  };
}
