export {
  SLA_OPTIONS,
  TRAVELLING_CHARGES_OPTIONS,
  FIELD_STATUS_OPTIONS,
  type CustomerSla,
  type TravellingCharges,
  type CustomerFieldStatus,
} from '../types/customer';

import type { CustomerFieldStatus, TravellingCharges } from '../types/customer';
import type { TranslationKey } from '../i18n/translations';

export function fieldStatusLabelKey(status: CustomerFieldStatus): TranslationKey {
  if (status === 'visible_mandatory') return 'fieldStatusVisibleMandatory';
  if (status === 'visible_optional') return 'fieldStatusVisibleOptional';
  return 'fieldStatusInvisible';
}

export function travellingChargesLabelKey(value: TravellingCharges): TranslationKey {
  if (value === 'billable_by_table') return 'travellingChargesBillableByTable';
  if (value === 'billable_by_km') return 'travellingChargesBillableByKm';
  return 'travellingChargesNonBillable';
}

export function truncateRemarks(value: string, maxLength = 30): string {
  if (!value) return '—';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}
