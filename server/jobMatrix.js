import { findDistrictById } from './districts.js';
import { listJobStenotypistCandidates, toPublicJob } from './jobs.js';
import { findProjectRecordById } from './projects.js';
import { listPublicHolidayRecords } from './publicHolidays.js';
import { listTravellingTimeRecords } from './travellingTimes.js';
import { findUserById } from './db.js';
import { readCollection } from './collectionStore.js';

export const CHARACTERS_PER_PAGE_CONSTANT = 2000;
export const STENOTYPING_INACTIVITY_THRESHOLD_MINUTES = 15;
/** §2.5 — Idle gap between timestamps ignored for stenotyping hours (seconds). */
export const TRANSCRIPT_STENOTYPING_IDLE_SECONDS = 60;

const MATRIX_SCHEDULE_RADIUS = 3;
const MATRIX_CENTER_COLUMN_INDEX = 3;

const SCHEDULE_JOB_STATUSES = new Set([
  'new',
  'approved',
  'pending',
  'assigned',
  'finished',
  'edited',
  'in_review',
  'reviewed',
  'published',
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readJobs() {
  return readCollection('jobs', { jobs: [] }).jobs ?? [];
}

function readLeaves() {
  return readCollection('stenotypistLeaves', { leaves: [] }).leaves ?? [];
}

function readSubmissions() {
  return readCollection('jobSubmissions', { submissions: [] }).submissions ?? [];
}

function readTranscripts() {
  return readCollection('transcripts', { transcripts: [] }).transcripts ?? [];
}

export function normalizeMatrixCenterDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value.trim())) {
    return '';
  }
  const date = value.trim();
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return date;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDate(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isWeekendDate(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isNonWorkingDay(date, holidayDates) {
  return isWeekendDate(date) || holidayDates.has(formatDateKey(date));
}

function getHolidayDateSet(holidays) {
  return new Set((holidays ?? []).map((holiday) => holiday.date).filter(Boolean));
}

function getPreviousWorkingDay(fromDate, holidayDates) {
  const cursor = shiftDate(fromDate, -1);
  while (isNonWorkingDay(cursor, holidayDates)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  return formatDateKey(cursor);
}

function getWorkingDaysBefore(centerDateKey, count, holidayDates) {
  const days = [];
  const cursor = new Date(`${centerDateKey}T12:00:00`);
  cursor.setDate(cursor.getDate() - 1);
  while (days.length < count) {
    const key = formatDateKey(cursor);
    if (!isNonWorkingDay(cursor, holidayDates)) {
      days.push(key);
    }
    cursor.setDate(cursor.getDate() - 1);
    if (days.length > 400) break;
  }
  return days;
}

function getMonthStartDateKey(centerDateKey) {
  const [year, month] = centerDateKey.split('-');
  return `${year}-${month}-01`;
}

function getMatrixScheduleDayKeys(centerDateKey) {
  const center = new Date(`${centerDateKey}T12:00:00`);
  return Array.from({ length: MATRIX_SCHEDULE_RADIUS * 2 + 1 }, (_, index) => {
    const offset = index - MATRIX_CENTER_COLUMN_INDEX;
    return formatDateKey(shiftDate(center, offset));
  });
}

function isActiveJob(job) {
  return job.status !== 'deleted' && job.status !== 'rejected';
}

function isScheduleJob(job) {
  if (!job.stenotypistUserId?.trim()) return false;
  return SCHEDULE_JOB_STATUSES.has(job.status);
}

function isUnassignedJob(job) {
  if (!isActiveJob(job)) return false;
  if (job.stenotypistUserId?.trim()) return false;
  return job.status === 'approved';
}

function isOnApprovedLeave(userId, dateKey, leaves) {
  return leaves.some(
    (leave) =>
      leave.stenotypistUserId === userId &&
      leave.status === 'approved' &&
      leave.dateFrom <= dateKey &&
      leave.dateTo >= dateKey,
  );
}

function findApprovedLeaveOnDay(userId, dateKey, leaves) {
  return (
    leaves.find(
      (leave) =>
        leave.stenotypistUserId === userId &&
        leave.status === 'approved' &&
        leave.dateFrom <= dateKey &&
        leave.dateTo >= dateKey,
    ) ?? null
  );
}

function isScheduledOut(job) {
  const location = (job.locationDetails ?? '').trim().toUpperCase();
  const remarks = (job.remarks ?? '').trim().toUpperCase();
  return location === 'OUT' || remarks.includes('OUT');
}

function projectField1Initial(project) {
  const value = (project?.field1Value ?? '').trim();
  return value ? value[0].toUpperCase() : '—';
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

function formatTravelMinutes(totalMinutes) {
  if (!totalMinutes) return '0';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function countBillableTranscriptCharacters(text) {
  if (typeof text !== 'string' || !text.trim()) return 0;
  let plain = text;
  if (plain.includes('{\\rtf')) {
    plain = plain
      .replace(/\\[a-z]+-?\d* ?/gi, ' ')
      .replace(/[{}]/g, ' ')
      .replace(/\\'[0-9a-f]{2}/gi, ' ');
  }
  plain = plain
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\bSPEAKER\s*\d*:?/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, '');
  return plain.length;
}

function getSubmissionForJob(jobId, submissions) {
  return submissions.find((submission) => submission.jobId === jobId) ?? null;
}

function getTranscriptPagesForJob(job, submissions) {
  const submission = getSubmissionForJob(job.id, submissions);
  const explicitCount = Number(submission?.transcriptCharacterCount);
  if (Number.isFinite(explicitCount) && explicitCount > 0) {
    return Math.round(explicitCount / CHARACTERS_PER_PAGE_CONSTANT);
  }
  const plainText =
    typeof submission?.transcriptPlainText === 'string' ? submission.transcriptPlainText : '';
  if (plainText) {
    return Math.round(countBillableTranscriptCharacters(plainText) / CHARACTERS_PER_PAGE_CONSTANT);
  }
  return 0;
}

function getTravellingMinutes(district1Id, district2Id, dateKey, trips) {
  if (!district1Id || !district2Id || district1Id === district2Id) return 0;
  const applicable = trips
    .filter(
      (trip) =>
        trip.validityFrom <= dateKey &&
        ((trip.district1Id === district1Id && trip.district2Id === district2Id) ||
          (trip.district1Id === district2Id && trip.district2Id === district1Id)),
    )
    .sort((a, b) => b.validityFrom.localeCompare(a.validityFrom));
  return applicable[0]?.travellingTime ?? 0;
}

function sumTravelMinutesForPeriod(userId, workingDayKeys, jobs, trips) {
  let total = 0;
  for (const dayKey of workingDayKeys) {
    const dayJobs = jobs
      .filter(
        (job) =>
          job.stenotypistUserId === userId &&
          job.date === dayKey &&
          isActiveJob(job) &&
          job.districtId,
      )
      .sort((a, b) => a.time.localeCompare(b.time));
    for (let index = 1; index < dayJobs.length; index += 1) {
      const previous = dayJobs[index - 1];
      const current = dayJobs[index];
      total += getTravellingMinutes(previous.districtId, current.districtId, dayKey, trips);
    }
  }
  return total;
}

function sumStenotypingHoursWithInactivity(
  userId,
  monthStartKey,
  centerDateKey,
  jobs,
  inactivityThreshold,
) {
  const timestamps = [];
  for (const job of jobs) {
    if (job.stenotypistUserId !== userId || !isActiveJob(job)) continue;
    if (job.date < monthStartKey || job.date > centerDateKey) continue;
    const start = job.startTimeAdministrator || job.startTimeStenotypist || job.time;
    const end = job.endTimeAdministrator || job.endTimeStenotypist;
    const startMinutes = parseTimeToMinutes(start);
    const endMinutes = parseTimeToMinutes(end);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) continue;
    timestamps.push({ start: startMinutes, end: endMinutes });
  }
  if (timestamps.length === 0) return 0;
  timestamps.sort((a, b) => a.start - b.start);
  let activeMinutes = 0;
  let currentStart = timestamps[0].start;
  let currentEnd = timestamps[0].end;
  for (let index = 1; index < timestamps.length; index += 1) {
    const next = timestamps[index];
    if (next.start - currentEnd <= inactivityThreshold) {
      currentEnd = Math.max(currentEnd, next.end);
    } else {
      activeMinutes += currentEnd - currentStart;
      currentStart = next.start;
      currentEnd = next.end;
    }
  }
  activeMinutes += currentEnd - currentStart;
  return activeMinutes / 60;
}

function findEditingWorkload(userId, transcripts) {
  const assigned = transcripts
    .filter(
      (transcript) =>
        transcript.editingAssignedToUserId === userId &&
        Number(transcript.editingPendingPages) > 0,
    )
    .map((transcript) => ({
      pendingPages: Number(transcript.editingPendingPages) || 0,
      deadline: transcript.editingDeadline ?? '',
    }))
    .filter((row) => row.deadline);

  if (assigned.length === 0) {
    return { pendingPages: 0, hoursToDeadline: null };
  }

  assigned.sort((a, b) => a.deadline.localeCompare(b.deadline));
  const earliest = assigned[0];
  const deadlineMs = new Date(earliest.deadline).getTime();
  const hoursToDeadline = Number.isNaN(deadlineMs)
    ? null
    : (deadlineMs - Date.now()) / (1000 * 60 * 60);

  return {
    pendingPages: earliest.pendingPages,
    hoursToDeadline,
  };
}

function computeM1(userId, previousWorkingDay, jobs, leaves) {
  if (isOnApprovedLeave(userId, previousWorkingDay, leaves)) {
    return 'LEA';
  }
  const dayJobs = jobs
    .filter(
      (job) =>
        job.stenotypistUserId === userId &&
        job.date === previousWorkingDay &&
        isActiveJob(job),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  if (dayJobs.length === 0) {
    return '—';
  }
  const job = dayJobs[0];
  if (isScheduledOut(job)) {
    return 'OUT';
  }
  const district = findDistrictById(job.districtId);
  const project = findProjectRecordById(job.projectId);
  const districtAlias = district?.alias || '—';
  return `${districtAlias}-${projectField1Initial(project)}`;
}

function computeMetrics(userId, context) {
  const {
    previousWorkingDay,
    workingDays14,
    monthStartKey,
    centerDateKey,
    jobs,
    leaves,
    submissions,
    transcripts,
    trips,
  } = context;

  const previousDayJobs = jobs.filter(
    (job) =>
      job.stenotypistUserId === userId &&
      job.date === previousWorkingDay &&
      isActiveJob(job),
  );

  const m2 = previousDayJobs.reduce(
    (total, job) => total + getTranscriptPagesForJob(job, submissions),
    0,
  );

  const m3 = previousDayJobs.reduce((total, job) => total + getBilledHours(job), 0);

  const m4 = workingDays14.reduce((total, dayKey) => {
    const dayHours = jobs
      .filter(
        (job) => job.stenotypistUserId === userId && job.date === dayKey && isActiveJob(job),
      )
      .reduce((sum, job) => sum + getBilledHours(job), 0);
    return total + dayHours;
  }, 0);

  const m5 = jobs
    .filter(
      (job) =>
        job.stenotypistUserId === userId &&
        isActiveJob(job) &&
        job.date >= monthStartKey &&
        job.date <= centerDateKey,
    )
    .reduce((total, job) => total + getBilledHours(job), 0);

  const m6 = sumStenotypingHoursWithInactivity(
    userId,
    monthStartKey,
    centerDateKey,
    jobs,
    STENOTYPING_INACTIVITY_THRESHOLD_MINUTES,
  );

  const editing = findEditingWorkload(userId, transcripts);
  const m7 = editing.pendingPages;
  const m8Value = editing.hoursToDeadline;
  const m8Late = m8Value !== null && m8Value < 0;
  const m8 = m8Value === null ? '—' : String(Math.round(m8Value));

  const m9Minutes = sumTravelMinutesForPeriod(userId, workingDays14, jobs, trips);

  return {
    m1: computeM1(userId, previousWorkingDay, jobs, leaves),
    m2: String(m2),
    m3: formatHours(m3),
    m4: formatHours(m4),
    m5: formatHours(m5),
    m6: formatHours(m6),
    m7: String(m7),
    m8,
    m8Late,
    m9: formatTravelMinutes(m9Minutes),
  };
}

function formatJobTitle(job) {
  const publicJob = toPublicJob(job);
  const location = publicJob.districtAlias || publicJob.locationDetails || '—';
  const customer = publicJob.customerAlias || publicJob.customerName || '—';
  return `${customer} - ${location} - ${job.jobNumber}`;
}

function mapJobCellStatus(status) {
  if (status === 'pending') return 'pending';
  if (status === 'assigned') return 'assigned';
  if (status === 'finished' || status === 'edited' || status === 'in_review' || status === 'reviewed') {
    return 'in-progress';
  }
  if (status === 'published' || status === 'reconciled' || status === 'invoiced') {
    return 'completed';
  }
  return 'assigned';
}

function formatJobCell(job) {
  const publicJob = toPublicJob(job);
  return {
    kind: 'job',
    id: job.id,
    status: mapJobCellStatus(job.status),
    jobStatus: job.status,
    title: formatJobTitle(job),
    customerAlias: publicJob.customerAlias || publicJob.customerName || '—',
    district: publicJob.districtAlias || publicJob.districtName || publicJob.locationDetails || '—',
    projectField1: publicJob.projectField1 || '—',
    projectField2: publicJob.projectField2 || '—',
    projectField3: publicJob.projectField3 || '—',
    time: job.time || '—',
  };
}

function buildScheduleForStenotypist(userId, jobs, leaves, scheduleDayKeys) {
  const schedule = {};
  for (const dayKey of scheduleDayKeys) {
    const entries = [];
    const approvedLeave = findApprovedLeaveOnDay(userId, dayKey, leaves);
    if (approvedLeave) {
      entries.push({ kind: 'leave_approved', id: approvedLeave.id });
    } else {
      const pendingLeave = leaves.find(
        (leave) =>
          leave.stenotypistUserId === userId &&
          leave.status === 'new' &&
          leave.dateFrom <= dayKey &&
          leave.dateTo >= dayKey,
      );
      if (pendingLeave) {
        entries.push({ kind: 'leave_request', id: pendingLeave.id });
      }

      const dayJobs = jobs
        .filter(
          (job) =>
            job.stenotypistUserId === userId && job.date === dayKey && isScheduleJob(job),
        )
        .sort((a, b) => a.time.localeCompare(b.time));

      for (const job of dayJobs) {
        entries.push(formatJobCell(job));
      }
    }

    if (entries.length > 0) {
      schedule[dayKey] = entries;
    }
  }
  return schedule;
}

function findAssetByStenotypistId(stenotypistId) {
  const data = readJson('stenotypistAssets.json', { assets: [] });
  return data.assets?.find((asset) => asset.stenotypistId === stenotypistId) ?? null;
}

function buildStenotypistInfo(user) {
  const asset = findAssetByStenotypistId(user.id);
  return {
    id: user.id,
    alias: user.username ?? '',
    fullName: user.fullName ?? '',
    email: user.email ?? '',
    contactPhone: user.contactPhone ?? '',
    mobilePhone: user.mobilePhone ?? '',
    laptopSerialNumber: asset?.laptopSerialNumber ?? '',
    stenotypeMachineSerialNumber: asset?.stenotypeMachineSerialNumber ?? '',
    catalystProductKey: asset?.catalystProductKey ?? '',
  };
}

function buildUnassignedJobs(jobs) {
  return jobs
    .filter(isUnassignedJob)
    .map((job) => {
      const publicJob = toPublicJob(job);
      return {
        id: job.id,
        customerAlias: publicJob.customerAlias || publicJob.customerName || '—',
        district: publicJob.districtAlias || publicJob.districtName || publicJob.locationDetails || '—',
        projectField1: publicJob.projectField1 || '—',
        projectField2: publicJob.projectField2 || '—',
        projectField3: publicJob.projectField3 || '—',
        title: formatJobTitle(job),
        time: job.time || '—',
        date: job.date,
        jobStatus: job.status,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function getJobMatrix(centerDateInput) {
  const centerDateKey = normalizeMatrixCenterDate(centerDateInput);
  if (!centerDateKey) {
    return { errors: ['jobMatrixCenterDateInvalid'] };
  }

  const holidays = listPublicHolidayRecords();
  const holidayDates = getHolidayDateSet(holidays);
  const previousWorkingDay = getPreviousWorkingDay(
    new Date(`${centerDateKey}T12:00:00`),
    holidayDates,
  );
  const workingDays14 = getWorkingDaysBefore(centerDateKey, 14, holidayDates);
  const monthStartKey = getMonthStartDateKey(centerDateKey);
  const scheduleDayKeys = getMatrixScheduleDayKeys(centerDateKey);

  const jobs = readJobs();
  const leaves = readLeaves();
  const submissions = readSubmissions();
  const transcripts = readTranscripts();
  const trips = listTravellingTimeRecords();

  const metricContext = {
    previousWorkingDay,
    workingDays14,
    monthStartKey,
    centerDateKey,
    jobs,
    leaves,
    submissions,
    transcripts,
    trips,
  };

  const candidates = listJobStenotypistCandidates();
  const stenotypists = candidates.map((candidate) => {
    const user = findUserById(candidate.id);
    return {
      id: candidate.id,
      alias: candidate.username,
      fullName: candidate.fullName,
      metrics: computeMetrics(candidate.id, metricContext),
      info: buildStenotypistInfo(user ?? { id: candidate.id, username: candidate.username }),
      schedule: buildScheduleForStenotypist(candidate.id, jobs, leaves, scheduleDayKeys),
    };
  });

  return {
    centerDate: centerDateKey,
    stenotypists,
    unassignedJobs: buildUnassignedJobs(jobs),
  };
}

/** §5.1 Stenotypist Summary Report — General Sheet (all stenotypists × M1–M9). */
export function getStenotypistSummaryReport(centerDateInput) {
  const matrix = getJobMatrix(centerDateInput);
  if (matrix.errors) {
    return matrix;
  }

  return {
    centerDate: matrix.centerDate,
    rows: matrix.stenotypists.map((row) => ({
      id: row.id,
      alias: row.alias,
      fullName: row.fullName,
      metrics: row.metrics,
    })),
  };
}
