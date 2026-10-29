import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDistrictById } from './districts.js';
import {
  CHARACTERS_PER_PAGE_CONSTANT,
} from './jobMatrix.js';
import { findProjectRecordById } from './projects.js';
import { listPublicHolidayRecords } from './publicHolidays.js';
import { validateAttachmentFileName } from './jobSubmissionAttachmentFiles.js';
import { listTravellingTimeRecords } from './travellingTimes.js';
import { findUserById } from './db.js';
import { resolveBonusConfigurationForStenotypist } from './stenotypistBonus.js';
import {
  getTranscriptDelayHoursBeyondSla,
  isTranscriptSubmittedLate,
} from './stenotypistPenalty.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '..', 'database');

export const STENOTYPIST_INFO_PERIODS = [
  'yesterday',
  'current_month',
  'last_30_days',
  'last_3_months',
  'last_6_months',
  'last_year',
];

const DELAYED_TRANSCRIPT_BUCKETS = ['under1', 'over1', 'over2', 'over4', 'over8', 'over24', 'over48'];

function readJson(relativePath, fallback) {
  const fullPath = path.join(DB_DIR, relativePath);
  if (!fs.existsSync(fullPath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
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
      .replace(/\\par[d]?/gi, '\n')
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

function estimatePersonalDictionaryLines(submission) {
  const file = submission?.attachmentFiles?.personalDictionary;
  if (!file) return 0;
  const explicit = Number(submission?.personalDictionaryLineCount);
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  const plainText =
    typeof submission?.personalDictionaryPlainText === 'string'
      ? submission.personalDictionaryPlainText
      : '';
  if (plainText.trim()) {
    return plainText.split(/\r?\n/).filter((line) => line.trim()).length;
  }
  if (Number.isFinite(file.size) && file.size > 0) {
    return Math.max(1, Math.round(file.size / 80));
  }
  return 0;
}

function getLatestSubmissionForJob(submissions, jobId) {
  return (
    submissions
      .filter((row) => row.jobId === jobId)
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0] ?? null
  );
}

function hasValidPersonalDictionaryUpload(jobNumber, submission) {
  const file = submission?.attachmentFiles?.personalDictionary;
  if (!file?.name) return false;
  return validateAttachmentFileName(jobNumber, file.name, 'personal_dictionary') === null;
}

function getTranscriptPagesForJob(job, submissions) {
  const submission = submissions.find((row) => row.jobId === job.id) ?? null;
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

function sumTravelMinutesForDateRange(userId, dateKeys, jobs, trips) {
  let total = 0;
  for (const dayKey of dateKeys) {
    const dayJobs = jobs
      .filter(
        (job) =>
          job.stenotypistUserId === userId &&
          job.date === dayKey &&
          job.status !== 'deleted' &&
          job.status !== 'rejected' &&
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

function enumerateDateKeys(fromKey, toKey) {
  const keys = [];
  const cursor = new Date(`${fromKey}T12:00:00`);
  const end = new Date(`${toKey}T12:00:00`);
  while (cursor <= end) {
    keys.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
    if (keys.length > 400) break;
  }
  return keys;
}

export function normalizeInfoPanelPeriod(value) {
  const period = typeof value === 'string' ? value.trim() : '';
  return STENOTYPIST_INFO_PERIODS.includes(period) ? period : 'current_month';
}

export function resolveInfoPanelPeriodRange(periodInput, anchorDateKey) {
  const period = normalizeInfoPanelPeriod(periodInput);
  const anchor = new Date(`${anchorDateKey}T12:00:00`);
  const toKey = formatDateKey(anchor);

  if (period === 'yesterday') {
    const yesterday = formatDateKey(shiftDate(anchor, -1));
    return { period, fromKey: yesterday, toKey: yesterday, label: period };
  }
  if (period === 'current_month') {
    const month = String(anchor.getMonth() + 1).padStart(2, '0');
    return {
      period,
      fromKey: `${anchor.getFullYear()}-${month}-01`,
      toKey,
      label: period,
    };
  }
  if (period === 'last_30_days') {
    return { period, fromKey: formatDateKey(shiftDate(anchor, -29)), toKey, label: period };
  }
  if (period === 'last_3_months') {
    return { period, fromKey: formatDateKey(shiftDate(anchor, -89)), toKey, label: period };
  }
  if (period === 'last_6_months') {
    return { period, fromKey: formatDateKey(shiftDate(anchor, -179)), toKey, label: period };
  }
  return { period: 'last_year', fromKey: formatDateKey(shiftDate(anchor, -364)), toKey, label: 'last_year' };
}

function classifyDelayHours(delayHours) {
  const buckets = {
    under1: 0,
    over1: 0,
    over2: 0,
    over4: 0,
    over8: 0,
    over24: 0,
    over48: 0,
  };
  if (delayHours <= 0) return buckets;
  if (delayHours <= 1) buckets.under1 += 1;
  if (delayHours > 1) buckets.over1 += 1;
  if (delayHours > 2) buckets.over2 += 1;
  if (delayHours > 4) buckets.over4 += 1;
  if (delayHours > 8) buckets.over8 += 1;
  if (delayHours > 24) buckets.over24 += 1;
  if (delayHours > 48) buckets.over48 += 1;
  return buckets;
}

function countLeaveDaysInRange(leave, fromKey, toKey) {
  const start = leave.dateFrom > fromKey ? leave.dateFrom : fromKey;
  const end = leave.dateTo < toKey ? leave.dateTo : toKey;
  if (start > end) return 0;
  return enumerateDateKeys(start, end).length;
}

function findAssetByStenotypistId(stenotypistId) {
  const data = readJson('stenotypistAssets.json', { assets: [] });
  return data.assets?.find((asset) => asset.stenotypistId === stenotypistId) ?? null;
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

function isOnApprovedLeave(userId, dateKey, leaves) {
  return leaves.some(
    (leave) =>
      leave.stenotypistUserId === userId &&
      leave.status === 'approved' &&
      leave.dateFrom <= dateKey &&
      leave.dateTo >= dateKey,
  );
}

function sumStenotypingHoursWithInactivity(userId, monthStartKey, centerDateKey, jobs, inactivityThreshold) {
  const timestamps = [];
  for (const job of jobs) {
    if (job.stenotypistUserId !== userId || job.status === 'deleted' || job.status === 'rejected') {
      continue;
    }
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

function computeMatrixMetrics(userId, centerDateKey, jobs, leaves, submissions, transcripts, trips) {
  const holidays = listPublicHolidayRecords();
  const holidayDates = new Set(holidays.map((holiday) => holiday.date).filter(Boolean));
  const center = new Date(`${centerDateKey}T12:00:00`);
  let previousWorkingDay = formatDateKey(shiftDate(center, -1));
  while (
    [0, 6].includes(new Date(`${previousWorkingDay}T12:00:00`).getDay()) ||
    holidayDates.has(previousWorkingDay)
  ) {
    previousWorkingDay = formatDateKey(
      shiftDate(new Date(`${previousWorkingDay}T12:00:00`), -1),
    );
  }

  const workingDays14 = [];
  const cursor = shiftDate(center, -1);
  while (workingDays14.length < 14) {
    const key = formatDateKey(cursor);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6 && !holidayDates.has(key)) {
      workingDays14.push(key);
    }
    cursor.setDate(cursor.getDate() - 1);
    if (workingDays14.length > 400) break;
  }

  const monthStartKey = `${centerDateKey.slice(0, 7)}-01`;
  const previousDayJobs = jobs.filter(
    (job) =>
      job.stenotypistUserId === userId &&
      job.date === previousWorkingDay &&
      job.status !== 'deleted' &&
      job.status !== 'rejected',
  );

  let m1 = '—';
  if (isOnApprovedLeave(userId, previousWorkingDay, leaves)) {
    m1 = 'LEA';
  } else if (previousDayJobs.length > 0) {
    const job = [...previousDayJobs].sort((a, b) => a.time.localeCompare(b.time))[0];
    if (isScheduledOut(job)) {
      m1 = 'OUT';
    } else {
      const district = findDistrictById(job.districtId);
      const project = findProjectRecordById(job.projectId);
      m1 = `${district?.alias || '—'}-${projectField1Initial(project)}`;
    }
  }

  const m2 = previousDayJobs.reduce(
    (total, job) => total + getTranscriptPagesForJob(job, submissions),
    0,
  );
  const m3 = previousDayJobs.reduce((total, job) => total + getBilledHours(job), 0);
  const m4 = workingDays14.reduce((total, dayKey) => {
    const dayHours = jobs
      .filter(
        (job) =>
          job.stenotypistUserId === userId &&
          job.date === dayKey &&
          job.status !== 'deleted' &&
          job.status !== 'rejected',
      )
      .reduce((sum, job) => sum + getBilledHours(job), 0);
    return total + dayHours;
  }, 0);
  const m5 = jobs
    .filter(
      (job) =>
        job.stenotypistUserId === userId &&
        job.status !== 'deleted' &&
        job.status !== 'rejected' &&
        job.date >= monthStartKey &&
        job.date <= centerDateKey,
    )
    .reduce((total, job) => total + getBilledHours(job), 0);

  const m6 = sumStenotypingHoursWithInactivity(
    userId,
    monthStartKey,
    centerDateKey,
    jobs,
    15,
  );

  const editing = transcripts
    .filter(
      (transcript) =>
        transcript.editingAssignedToUserId === userId &&
        Number(transcript.editingPendingPages) > 0,
    )
    .map((transcript) => ({
      pendingPages: Number(transcript.editingPendingPages) || 0,
      deadline: transcript.editingDeadline ?? '',
    }))
    .filter((row) => row.deadline)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];

  const m7 = editing?.pendingPages ?? 0;
  const m8Value = editing
    ? (new Date(editing.deadline).getTime() - Date.now()) / (1000 * 60 * 60)
    : null;

  return {
    m1,
    m2: String(m2),
    m3: formatHours(m3),
    m4: formatHours(m4),
    m5: formatHours(m5),
    m6: formatHours(m6),
    m7: String(m7),
    m8: m8Value === null ? '—' : String(Math.round(m8Value)),
    m8Late: m8Value !== null && m8Value < 0,
    m9: formatTravelMinutes(sumTravelMinutesForDateRange(userId, workingDays14, jobs, trips)),
  };
}

export function getStenotypistInfoPanel(stenotypistUserId, { period, centerDate } = {}) {
  if (!stenotypistUserId) {
    return { errors: ['stenotypistInfoUserRequired'] };
  }

  const user = findUserById(stenotypistUserId);
  if (!user) {
    return { errors: ['stenotypistInfoUserNotFound'] };
  }

  const anchorDateKey =
    typeof centerDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(centerDate.trim())
      ? centerDate.trim()
      : formatDateKey(new Date());

  const range = resolveInfoPanelPeriodRange(period, anchorDateKey);
  const dateKeys = enumerateDateKeys(range.fromKey, range.toKey);

  const jobs = readJson('jobs.json', { jobs: [] }).jobs ?? [];
  const leaves = readJson('stenotypistLeaves.json', { leaves: [] }).leaves ?? [];
  const submissions = readJson('jobSubmissions.json', { submissions: [] }).submissions ?? [];
  const transcripts = readJson('transcripts.json', { transcripts: [] }).transcripts ?? [];
  const trips = listTravellingTimeRecords();
  const asset = findAssetByStenotypistId(stenotypistUserId);

  const userJobs = jobs.filter(
    (job) =>
      job.stenotypistUserId === stenotypistUserId &&
      job.status !== 'deleted' &&
      job.status !== 'rejected',
  );

  const periodJobs = userJobs.filter((job) => job.date >= range.fromKey && job.date <= range.toKey);
  const travelMinutes = sumTravelMinutesForDateRange(stenotypistUserId, dateKeys, jobs, trips);
  const billedHours = periodJobs.reduce((total, job) => total + getBilledHours(job), 0);
  const pagesWritten = periodJobs.reduce(
    (total, job) => total + getTranscriptPagesForJob(job, submissions),
    0,
  );

  const pendingTranscriptPages = transcripts
    .filter(
      (transcript) =>
        transcript.editingAssignedToUserId === stenotypistUserId &&
        Number(transcript.editingPendingPages) > 0,
    )
    .reduce((total, transcript) => total + (Number(transcript.editingPendingPages) || 0), 0);

  const outJobs = userJobs
    .filter((job) => isScheduledOut(job) && job.date <= anchorDateKey)
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  const lastOutJob = outJobs[0] ?? null;
  const daysOut = lastOutJob
    ? enumerateDateKeys(lastOutJob.date, anchorDateKey).length - 1
    : 0;

  const delayedBuckets = Object.fromEntries(DELAYED_TRANSCRIPT_BUCKETS.map((key) => [key, 0]));
  let delayedTranscriptCount = 0;

  for (const job of periodJobs) {
    const submission = submissions.find((row) => row.jobId === job.id);
    if (!isTranscriptSubmittedLate(job, submission)) continue;
    const delayHours = getTranscriptDelayHoursBeyondSla(job, submission);
    delayedTranscriptCount += 1;
    const bucketCounts = classifyDelayHours(delayHours);
    for (const key of DELAYED_TRANSCRIPT_BUCKETS) {
      delayedBuckets[key] += bucketCounts[key];
    }
  }

  const currentYear = anchorDateKey.slice(0, 4);
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;
  const approvedLeaves = leaves.filter(
    (leave) => leave.stenotypistUserId === stenotypistUserId && leave.status === 'approved',
  );
  const leaveTakenDays = approvedLeaves.reduce((total, leave) => {
    const rangeEnd = leave.dateTo < anchorDateKey ? leave.dateTo : anchorDateKey;
    if (leave.dateFrom > rangeEnd || leave.dateFrom > yearEnd) return total;
    const from = leave.dateFrom > yearStart ? leave.dateFrom : yearStart;
    return total + countLeaveDaysInRange(leave, from, rangeEnd);
  }, 0);
  const approvedLeaveUpcomingDays = approvedLeaves
    .filter((leave) => leave.dateTo >= anchorDateKey)
    .reduce((total, leave) => total + countLeaveDaysInRange(leave, anchorDateKey, yearEnd), 0);

  const monthStartKey = `${anchorDateKey.slice(0, 7)}-01`;
  const monthBillableHours = userJobs
    .filter((job) => job.date >= monthStartKey && job.date <= anchorDateKey)
    .reduce((total, job) => total + getBilledHours(job), 0);
  const bonusSettings = resolveBonusConfigurationForStenotypist(stenotypistUserId, anchorDateKey);
  const baseHours = bonusSettings.baseHours;
  const extraHours = Math.max(0, monthBillableHours - baseHours);
  const bonusPerExtraHour = bonusSettings.bonusPerExtraHour;
  const bonus = extraHours * bonusPerExtraHour;

  const personalDictionaryEntries = userJobs
    .map((job) => {
      const submission = getLatestSubmissionForJob(submissions, job.id);
      if (!hasValidPersonalDictionaryUpload(job.jobNumber, submission)) return null;
      return {
        jobId: job.id,
        jobNumber: job.jobNumber,
        date: job.date,
        lines: estimatePersonalDictionaryLines(submission),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date) || b.jobNumber.localeCompare(a.jobNumber));

  const metrics = computeMatrixMetrics(
    stenotypistUserId,
    anchorDateKey,
    jobs,
    leaves,
    submissions,
    transcripts,
    trips,
  );

  return {
    stenotypistUserId,
    alias: user.username ?? '',
    fullName: user.fullName ?? '',
    email: user.email ?? '',
    contactPhone: user.contactPhone ?? '',
    mobilePhone: user.mobilePhone ?? '',
    centerDate: anchorDateKey,
    period: range.period,
    metrics,
    assets: {
      laptopSerialNumber: asset?.laptopSerialNumber ?? '',
      stenotypeMachineSerialNumber: asset?.stenotypeMachineSerialNumber ?? '',
      eKeyNumber: asset?.catalystProductKey ?? asset?.eKeyNumber ?? '',
      eKeyExpiryDate: asset?.eKeyExpiryDate ?? '',
    },
    bonus: {
      totalBillableHours: formatHours(monthBillableHours),
      baseHours: String(baseHours),
      extraHours: formatHours(extraHours),
      bonusPerExtraHour: String(bonusPerExtraHour),
      bonus: bonus.toFixed(2),
    },
    personalDictionaryEntries,
    leave: {
      daysTakenCurrentYear: leaveTakenDays,
      approvedLeaveUpcomingDays,
    },
    periodInfo: {
      travellingTime: formatTravelMinutes(travelMinutes),
      travellingBilledHoursRatio:
        billedHours > 0 ? (travelMinutes / 60 / billedHours).toFixed(2) : '—',
      totalPagesWritten: String(pagesWritten),
      pendingTranscriptPages: String(pendingTranscriptPages),
      totalPagesWrittenPlusPending: String(pagesWritten + pendingTranscriptPages),
      pagesWrittenBilledHoursRatio:
        billedHours > 0 ? (pagesWritten / billedHours).toFixed(2) : '—',
      daysOut,
      lastDateOut: lastOutJob?.date ?? '—',
      delayedTranscriptCount,
      delayedTranscriptBuckets: delayedBuckets,
    },
  };
}
