import { findProjectRecordById } from './projects.js';
import {
  resolveTravellingChargeAmount,
} from './travellingCharges.js';

function normalizePositiveDecimal(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100) / 100;
}

/** §3.1 — Resolve system travelling charge amount based on project billing mode.
 * Billable travelling for multiple jobs (same customer, same day) is not auto-consolidated. */
export function computeSystemTravellingChargeAmountForJob(job) {
  if (!job?.projectId) return 0;

  const project = findProjectRecordById(job.projectId);
  const travellingCharges = project?.travellingCharges ?? 'non_billable';

  if (travellingCharges === 'non_billable') {
    return 0;
  }

  if (travellingCharges === 'billable_by_km') {
    const km = normalizePositiveDecimal(job.travellingKm);
    const rate = normalizePositiveDecimal(job.travellingKmRate);
    if (km === null || rate === null) return 0;
    return Math.round(km * rate * 100) / 100;
  }

  const customerId = project?.customerId ?? '';
  const districtId = job.districtId ?? '';
  if (!customerId || !districtId || !job.date) return 0;

  const amount = resolveTravellingChargeAmount(customerId, districtId, job.date);
  return amount ?? 0;
}

export function getProjectTravellingChargesForJob(job) {
  if (!job?.projectId) return 'non_billable';
  const project = findProjectRecordById(job.projectId);
  return project?.travellingCharges ?? 'non_billable';
}

export function isBillableTravellingChargesMode(mode) {
  return mode === 'billable_by_table' || mode === 'billable_by_km';
}
