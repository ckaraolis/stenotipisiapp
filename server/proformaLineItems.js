import { findCustomerById } from './customers.js';
import { isBillableTravellingChargesMode } from './jobTravellingCharges.js';
import { listJobRecords, normalizeJobTravellingChargeAmount } from './jobs.js';

function parseTimeToMinutes(time) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(typeof time === 'string' ? time.trim() : '');
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function computeJobDurationHours(startTime, endTime) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) return null;
  let end = endMinutes;
  if (end <= startMinutes) end += 24 * 60;
  return Math.round(((end - startMinutes) / 60) * 1000) / 1000;
}

function computeStenotypingLineTotal(durationHours, hourlyRate) {
  return Math.round(durationHours * hourlyRate * 100) / 100;
}

function formatProjectLabel(job) {
  const parts = [job.projectField1, job.projectField2, job.projectField3, job.projectField4].filter(
    (part) => part?.trim(),
  );
  return parts.length > 0 ? parts.join(' + ') : '—';
}

function isTravellingDue(job) {
  if (!isBillableTravellingChargesMode(job.projectTravellingCharges)) return false;
  return normalizeJobTravellingChargeAmount(job.travellingChargesAdministrator) > 0;
}

function buildItemForJob(job, type, hourlyRate) {
  if (type === 'travelling') {
    const travellingCharges = normalizeJobTravellingChargeAmount(job.travellingChargesAdministrator);
    return {
      id: `${job.id}:travelling`,
      type: 'travelling',
      jobId: job.id,
      jobNumber: job.jobNumber,
      jobDate: job.date,
      jobStatus: job.status,
      projectLabel: formatProjectLabel(job),
      stenotypistAlias: job.stenotypistAlias || '—',
      receiptNumber: job.receiptNumberAdministrator || '',
      jobDurationHours: null,
      hourlyRate: null,
      districtLabel: job.districtAlias || job.districtName || '—',
      travellingCharges,
      lineTotal: travellingCharges,
    };
  }

  const jobDurationHours = computeJobDurationHours(
    job.startTimeAdministrator,
    job.endTimeAdministrator,
  );
  const rate = hourlyRate ?? 0;
  const lineTotal =
    jobDurationHours !== null ? computeStenotypingLineTotal(jobDurationHours, rate) : 0;

  return {
    id: `${job.id}:stenotyping`,
    type: 'stenotyping',
    jobId: job.id,
    jobNumber: job.jobNumber,
    jobDate: job.date,
    jobStatus: job.status,
    projectLabel: formatProjectLabel(job),
    stenotypistAlias: job.stenotypistAlias || '—',
    receiptNumber: job.receiptNumberAdministrator || '',
    jobDurationHours,
    hourlyRate: rate,
    districtLabel: job.districtAlias || job.districtName || '—',
    travellingCharges: null,
    lineTotal,
  };
}

/** Build stenotyping + travelling line items for jobs on a proforma. */
export function buildProformaLineItems(proforma) {
  const customer = findCustomerById(proforma.customerId);
  const hourlyRate = customer?.hourlyRate ?? 0;
  const items = [];

  for (const jobId of proforma.jobIds ?? []) {
    const job = listJobRecords(null).find((row) => row.id === jobId);
    if (!job) continue;
    items.push(buildItemForJob(job, 'stenotyping', hourlyRate));
    if (isTravellingDue(job)) {
      items.push(buildItemForJob(job, 'travelling', hourlyRate));
    }
  }

  return items.sort((a, b) => {
    const dateCompare = a.jobDate.localeCompare(b.jobDate);
    if (dateCompare !== 0) return dateCompare;
    if (a.jobNumber !== b.jobNumber) return a.jobNumber.localeCompare(b.jobNumber);
    return a.type === 'stenotyping' ? -1 : 1;
  });
}

export function computeProformaTotalAmount(proforma) {
  const total = buildProformaLineItems(proforma).reduce((sum, item) => sum + item.lineTotal, 0);
  return Math.round(total * 100) / 100;
}

export function formatProformaCustomerLabel(customer) {
  if (!customer) return '—';
  const alias = typeof customer.alias === 'string' ? customer.alias.trim() : '';
  const name = typeof customer.name === 'string' ? customer.name.trim() : '';
  if (alias && name) return `${alias} + ${name}`;
  return alias || name || '—';
}
