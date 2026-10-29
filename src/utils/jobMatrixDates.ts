import {
  formatAllocationDateKey,
  isWeekendDate,
  mockMatrixPublicHolidayDates,
  shiftDate,
} from '../data/mockJobAllocation';

/** Days shown left/right of the center column (7 columns total). */
export const MATRIX_SCHEDULE_RADIUS = 3;

export const MATRIX_CENTER_COLUMN_INDEX = MATRIX_SCHEDULE_RADIUS;

export function isNonWorkingDay(date: Date, holidayDates: ReadonlySet<string>): boolean {
  return isWeekendDate(date) || holidayDates.has(formatAllocationDateKey(date));
}

/** First working day on or after `from` (skips weekends and public holidays). */
export function getNextWorkingDay(
  from: Date = new Date(),
  holidayDates: ReadonlySet<string> = mockMatrixPublicHolidayDates,
): Date {
  const candidate = normalizeMatrixDate(from);
  while (isNonWorkingDay(candidate, holidayDates)) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

export function normalizeMatrixDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
}

export function parseMatrixDateKey(dateKey: string): Date {
  return normalizeMatrixDate(new Date(`${dateKey}T12:00:00`));
}

/** Seven schedule columns: center −3 … center +3. */
export function getMatrixScheduleDays(centerDate: Date): Date[] {
  const center = normalizeMatrixDate(centerDate);
  return Array.from({ length: MATRIX_SCHEDULE_RADIUS * 2 + 1 }, (_, index) => {
    const offset = index - MATRIX_CENTER_COLUMN_INDEX;
    return shiftDate(center, offset);
  });
}

export function shiftMatrixCenterDay(centerDate: Date, dayOffset: number): Date {
  return shiftDate(normalizeMatrixDate(centerDate), dayOffset);
}

export function shiftMatrixCenterWeek(centerDate: Date, weekOffset: number): Date {
  return shiftMatrixCenterDay(centerDate, weekOffset * 7);
}

export function buildHolidayDateSet(
  holidays: { date: string }[],
  fallback: ReadonlySet<string> = mockMatrixPublicHolidayDates,
): Set<string> {
  if (holidays.length === 0) {
    return new Set(fallback);
  }
  return new Set(holidays.map((holiday) => holiday.date));
}

export function isMatrixCenterColumn(columnIndex: number): boolean {
  return columnIndex === MATRIX_CENTER_COLUMN_INDEX;
}
