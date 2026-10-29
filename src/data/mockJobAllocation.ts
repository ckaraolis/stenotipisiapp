export type AllocationJobStatus =
  | 'pending'
  | 'assigned'
  | 'in-progress'
  | 'completed'
  | 'published'
  | 'draft';

function mockScheduleJob(
  id: string,
  status: AllocationJobStatus,
  customerAlias: string,
  district: string,
  projectField1: string,
  projectField2: string,
  projectField3: string,
  time: string,
  jobNumber: string,
  jobStatus = status === 'pending' ? 'pending' : 'assigned',
): Extract<MatrixCellEntry, { kind: 'job' }> {
  return {
    kind: 'job',
    id,
    status,
    jobStatus,
    title: `${customerAlias} - ${district} - ${jobNumber}`,
    customerAlias,
    district,
    projectField1,
    projectField2,
    projectField3,
    time,
  };
}

export type MatrixCellEntry =
  | {
      kind: 'job';
      id: string;
      status: AllocationJobStatus;
      jobStatus: string;
      title: string;
      customerAlias: string;
      district: string;
      projectField1: string;
      projectField2: string;
      projectField3: string;
      time: string;
    }
  | {
      kind: 'leave_request';
      id: string;
    }
  | {
      kind: 'leave_approved';
      id: string;
    };

export interface MatrixMetrics {
  m1: string;
  m2: string;
  m3: string;
}

export interface MatrixStaffRow {
  st: string;
  metrics: MatrixMetrics;
  schedule: Record<string, MatrixCellEntry[]>;
}

export interface MatrixPendingJob {
  id: string;
  title: string;
  time: string;
  customer: string;
  location: string;
  customerAlias: string;
  district: string;
  projectField1: string;
  projectField2: string;
  projectField3: string;
  date: string;
}

export const matrixMetricColumns = ['m1', 'm2', 'm3'] as const;
export type MatrixMetricKey = (typeof matrixMetricColumns)[number];

const weekBase = {
  mon: '2024-08-26',
  tue: '2024-08-27',
  wed: '2024-08-28',
  thu: '2024-08-29',
  fri: '2024-08-30',
  sat: '2024-08-31',
  sun: '2024-09-01',
};

export const mockMatrixPublicHolidayDates = new Set([weekBase.tue]);

export const mockMatrixStaff: MatrixStaffRow[] = [
  {
    st: 'MKL',
    metrics: { m1: '12', m2: '4', m3: '2' },
    schedule: {
      [weekBase.thu]: [{ kind: 'leave_request', id: 'mkl-leave-req-1' }],
      [weekBase.tue]: [
        mockScheduleJob(
          'mkl-job-1',
          'assigned',
          'MOF',
          'NICOSIA',
          'Court',
          'Civil',
          'Case A',
          '11:00-13:00',
          '1234',
        ),
      ],
      [weekBase.wed]: [
        mockScheduleJob(
          'mkl-job-2',
          'assigned',
          'MOF',
          'NICOSIA',
          'Court',
          'Civil',
          'Case A',
          '11:00-13:00',
          '1234',
        ),
      ],
      [weekBase.fri]: [
        mockScheduleJob(
          'mkl-job-3',
          'assigned',
          'MOF',
          'NICOSIA',
          'Court',
          'Civil',
          'Case A',
          '11:00-13:00',
          '1234',
        ),
      ],
      [weekBase.sat]: [{ kind: 'leave_approved', id: 'mkl-leave-1' }],
    },
  },
  {
    st: 'GST',
    metrics: { m1: '9', m2: '3', m3: '1' },
    schedule: {
      [weekBase.mon]: [
        { kind: 'leave_request', id: 'gst-leave-req-1' },
        { kind: 'leave_request', id: 'gst-leave-req-2' },
      ],
      [weekBase.wed]: [
        mockScheduleJob(
          'gst-job-1',
          'assigned',
          'MOF',
          'NICOSIA',
          'Court',
          'Civil',
          'Case B',
          '11:00-13:00',
          '1234',
        ),
      ],
    },
  },
  {
    st: 'ABC',
    metrics: { m1: '7', m2: '2', m3: '0' },
    schedule: {
      [weekBase.mon]: [
        mockScheduleJob(
          'abc-job-1',
          'assigned',
          'MOF',
          'LARNACA',
          'Court',
          'Criminal',
          'Case C',
          '11:00-13:00',
          '07891',
        ),
      ],
      [weekBase.tue]: [{ kind: 'leave_request', id: 'abc-leave-req-1' }],
      [weekBase.wed]: [
        mockScheduleJob(
          'abc-job-2',
          'assigned',
          'SCF',
          'NICOSIA',
          'Court',
          'Civil',
          'Case D',
          '11:00-13:00',
          '3456',
        ),
      ],
      [weekBase.thu]: [{ kind: 'leave_request', id: 'abc-leave-req-2' }],
      [weekBase.fri]: [{ kind: 'leave_request', id: 'abc-leave-req-3' }],
      [weekBase.sat]: [{ kind: 'leave_request', id: 'abc-leave-req-4' }],
      [weekBase.sun]: [{ kind: 'leave_request', id: 'abc-leave-req-5' }],
    },
  },
];

export const mockMatrixPendingJobs: MatrixPendingJob[] = [
  {
    id: 'pending-1',
    customer: 'MOF',
    location: 'NICOSIA',
    customerAlias: 'MOF',
    district: 'NICOSIA',
    projectField1: 'Court',
    projectField2: 'Civil',
    projectField3: 'Case E',
    title: 'MOF - NICOSIA - 1234',
    time: '11:00-13:00',
    date: weekBase.wed,
  },
  {
    id: 'pending-2',
    customer: 'MOF',
    location: 'LARNACA',
    customerAlias: 'MOF',
    district: 'LARNACA',
    projectField1: 'Court',
    projectField2: 'Criminal',
    projectField3: 'Case F',
    title: 'MOF - LARNACA - 07891',
    time: '11:00-13:00',
    date: weekBase.mon,
  },
  {
    id: 'pending-3',
    customer: 'SCF',
    location: 'NICOSIA',
    customerAlias: 'SCF',
    district: 'NICOSIA',
    projectField1: 'Court',
    projectField2: 'Civil',
    projectField3: 'Case G',
    title: 'SCF - NICOSIA - 3456',
    time: '11:00-13:00',
    date: weekBase.wed,
  },
];

export function formatAllocationDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatMatrixDayLabel(date: Date, locale: string): string {
  const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
  const day = date.getDate();
  const month = date.getMonth() + 1;
  return `${weekday} ${day}/${month}`;
}

export function formatDisplayDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getWeekDays(anchor: Date): Date[] {
  const start = new Date(anchor);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

export function shiftDate(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isWeekendDate(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
