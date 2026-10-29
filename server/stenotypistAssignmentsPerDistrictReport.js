import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listDistricts } from './districts.js';
import { listJobStenotypistCandidates } from './jobs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '..', 'database');

export const ASSIGNMENTS_PER_DISTRICT_PAGE_SIZE = 50;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readJobs() {
  const jobsPath = path.join(DB_DIR, 'jobs.json');
  if (!fs.existsSync(jobsPath)) {
    return [];
  }
  const data = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
  return data.jobs ?? [];
}

function parseTimeToMinutes(value) {
  if (typeof value !== 'string' || !value.includes(':')) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function getBilledHours(job) {
  const start = job.startTimeAdministrator || job.startTimeStenotypist || job.time;
  const end = job.endTimeAdministrator || job.endTimeStenotypist;
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes < startMinutes) {
    return 0;
  }
  return (endMinutes - startMinutes) / 60;
}

function formatHours(hours) {
  if (!hours) return '0';
  return hours.toFixed(1);
}

function isActiveJob(job) {
  return job.status !== 'deleted' && job.status !== 'rejected';
}

function normalizeDateKey(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return DATE_KEY_PATTERN.test(trimmed) ? trimmed : '';
}

export function getThisMonthDateRange(anchorDate = new Date()) {
  const year = anchorDate.getFullYear();
  const month = String(anchorDate.getMonth() + 1).padStart(2, '0');
  const day = String(anchorDate.getDate()).padStart(2, '0');
  return {
    dateFrom: `${year}-${month}-01`,
    dateTo: `${year}-${month}-${day}`,
  };
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

/** §5.2 Stenotypist Assignments Per District — matrix of billed hours by stenotypist × district. */
export function getStenotypistAssignmentsPerDistrictReport({
  dateFrom: dateFromInput,
  dateTo: dateToInput,
  page: pageInput,
  pageSize: pageSizeInput,
  sortDirection: sortDirectionInput,
} = {}) {
  const defaults = getThisMonthDateRange();
  const dateFrom = normalizeDateKey(dateFromInput) || defaults.dateFrom;
  const dateTo = normalizeDateKey(dateToInput) || defaults.dateTo;

  if (dateFrom > dateTo) {
    return { errors: ['assignmentsPerDistrictDateRangeInvalid'] };
  }

  const pageSize = Math.min(
    parsePositiveInt(pageSizeInput, ASSIGNMENTS_PER_DISTRICT_PAGE_SIZE),
    ASSIGNMENTS_PER_DISTRICT_PAGE_SIZE,
  );
  const sortDirection = sortDirectionInput === 'desc' ? 'desc' : 'asc';

  const districts = listDistricts();
  const districtIds = districts.map((district) => district.id);

  const jobs = readJobs().filter(
    (job) =>
      isActiveJob(job) &&
      job.stenotypistUserId?.trim() &&
      job.districtId?.trim() &&
      job.date >= dateFrom &&
      job.date <= dateTo,
  );

  const hoursByUser = new Map();
  for (const job of jobs) {
    const userId = job.stenotypistUserId;
    const districtId = job.districtId;
    if (!hoursByUser.has(userId)) {
      hoursByUser.set(userId, new Map());
    }
    const userDistrictHours = hoursByUser.get(userId);
    userDistrictHours.set(districtId, (userDistrictHours.get(districtId) ?? 0) + getBilledHours(job));
  }

  const candidates = listJobStenotypistCandidates();
  const sortedCandidates = [...candidates].sort((a, b) => {
    const byName = a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' });
    if (byName !== 0) {
      return sortDirection === 'asc' ? byName : -byName;
    }
    const byAlias = a.username.localeCompare(b.username, undefined, { sensitivity: 'base' });
    return sortDirection === 'asc' ? byAlias : -byAlias;
  });

  const allRows = sortedCandidates.map((candidate) => {
    const districtHours = hoursByUser.get(candidate.id) ?? new Map();
    const hoursByDistrictId = Object.fromEntries(
      districtIds.map((districtId) => [districtId, formatHours(districtHours.get(districtId) ?? 0)]),
    );
    return {
      id: candidate.id,
      alias: candidate.username,
      fullName: candidate.fullName,
      hoursByDistrictId,
    };
  });

  const totalRows = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const page = Math.min(parsePositiveInt(pageInput, 1), totalPages);
  const rows = allRows.slice((page - 1) * pageSize, page * pageSize);

  return {
    dateFrom,
    dateTo,
    sortDirection,
    districts,
    rows,
    pagination: {
      page,
      pageSize,
      totalRows,
      totalPages,
    },
  };
}
