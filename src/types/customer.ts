export const SLA_OPTIONS = [
  '1 day',
  '2 days',
  '3 days',
  '4 days',
  '5 days',
  '6 days',
  '7 days',
  '8 days',
  '9 days',
  '10 days',
] as const;

export type CustomerSla = (typeof SLA_OPTIONS)[number];

export const TRAVELLING_CHARGES_OPTIONS = [
  'billable_by_table',
  'billable_by_km',
  'non_billable',
] as const;

export type TravellingCharges = (typeof TRAVELLING_CHARGES_OPTIONS)[number];

export const FIELD_STATUS_OPTIONS = [
  'invisible',
  'visible_mandatory',
  'visible_optional',
] as const;

export type CustomerFieldStatus = (typeof FIELD_STATUS_OPTIONS)[number];

export interface CustomerFieldValue {
  id: string;
  customerId: string;
  fieldReference: 1 | 2;
  value: string;
  order: number;
}

export interface CustomerRecord {
  id: string;
  customerNumber: string;
  name: string;
  alias: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  priorityErpNumber: string;
  hourlyRate: number;
  sla: CustomerSla;
  travellingCharges: TravellingCharges;
  remarks: string;
  field1Status: CustomerFieldStatus;
  field1Name: string;
  field2Status: CustomerFieldStatus;
  field2Name: string;
  field3Status: CustomerFieldStatus;
  field3Name: string;
  field4Status: CustomerFieldStatus;
  field4Name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  fieldValues?: CustomerFieldValue[];
}

export interface CustomerPayload {
  name: string;
  alias: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  priorityErpNumber?: string;
  hourlyRate?: number;
  sla?: CustomerSla | string;
  travellingCharges?: TravellingCharges | string;
  remarks?: string;
  field1Status?: CustomerFieldStatus | string;
  field1Name?: string;
  field2Status?: CustomerFieldStatus | string;
  field2Name?: string;
  field3Status?: CustomerFieldStatus | string;
  field3Name?: string;
  field4Status?: CustomerFieldStatus | string;
  field4Name?: string;
  enabled?: boolean;
}

export interface CustomerFieldValuePayload {
  fieldReference: 1 | 2;
  value: string;
  order?: number;
}
