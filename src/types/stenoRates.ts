export interface StenoRateRecord {
  id: string;
  customerId: string;
  customerName: string;
  customerAlias: string;
  hourlyRate: number;
  hourlyRateExpedited: number;
  hourlyRateOutsideWorkingHrs: number;
  hourlyRateOutsideWorkingHrsExpedited: number;
  firstDiscountPercentage: number;
  nrExemptedStenotypists: number;
  secondDiscountPercentage: number;
  secondStenotypistDiscountThreshold: number;
  travelByKmAmount: number;
  sla: string;
  slaExpedited: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  validityFrom: string;
  createdAt: string;
  updatedAt: string;
}

export interface StenoRatePayload {
  customerId: string;
  hourlyRate: number | string;
  hourlyRateExpedited: number | string;
  hourlyRateOutsideWorkingHrs: number | string;
  hourlyRateOutsideWorkingHrsExpedited: number | string;
  firstDiscountPercentage: number | string;
  nrExemptedStenotypists: number | string;
  secondDiscountPercentage: number | string;
  secondStenotypistDiscountThreshold: number | string;
  travelByKmAmount: number | string;
  sla: string;
  slaExpedited: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  validityFrom: string;
}

export interface StenoRateListQuery {
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export type StenoRateImportRow = Record<string, string | number | boolean | null | undefined>;

export interface StenoRateImportResult {
  created: number;
  updated: number;
  skipped: number;
  customersCreated?: number;
  errors: Array<{ row: number; message: string; detail?: string }>;
}
