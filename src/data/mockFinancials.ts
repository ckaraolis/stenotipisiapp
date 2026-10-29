export interface AudioRemunerationRow {
  audioTranscriber: string;
  percentage: string;
  targetHoursBeforeDeadline: string;
  penaltyPerHourLate: string;
  validFrom: string;
}

export const mockAudioRemuneration: AudioRemunerationRow[] = [];

export interface RateRow {
  customer: string;
  hourlyRate: string;
  hourlyRateExpedited: string;
  hourlyRateOutsideWorkingHrs: string;
  hourlyRateOutsideWorkingHrsExpedited: string;
  firstDiscountPercentage: string;
  nrExemptedStenotypists: string;
  secondDiscountPercentage: string;
  secondStenotypistDiscountThreshold: string;
  travelByKmAmount: string;
  sla: string;
  slaExpedited: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  validityFrom: string;
}

export const mockStenoRates: RateRow[] = [];
export const mockAudioRates: RateRow[] = [];
export const mockCaptionRates: RateRow[] = [];

export interface TravellingChargeRow {
  customer: string;
  district: string;
  amount: string;
  validityFrom: string;
}

export const mockTravellingCharges: TravellingChargeRow[] = [];

export interface SimpleFinancialRow {
  customer: string;
  description: string;
  amount: string;
  validityFrom: string;
  status: string;
}

export const mockTravExpConfiguration: SimpleFinancialRow[] = [];
export const mockBonusConfiguration: SimpleFinancialRow[] = [];
export const mockPenaltyConfiguration: SimpleFinancialRow[] = [];
