export const MATRIX_JOB_DRAG_TYPE = 'application/x-stenotipisi-matrix-job';

export type MatrixJobDragSource = 'unassigned' | 'schedule';

export interface MatrixJobDragData {
  jobId: string;
  source: MatrixJobDragSource;
  jobStatus: string;
  stenotypistUserId?: string;
  dateKey?: string;
}

export {
  MATRIX_DRAGGABLE_JOB_STATUSES,
  MATRIX_UNASSIGNABLE_JOB_STATUSES,
} from '../config/allocationJobStatus';

export function writeMatrixJobDragData(dataTransfer: DataTransfer, data: MatrixJobDragData): void {
  dataTransfer.setData(MATRIX_JOB_DRAG_TYPE, JSON.stringify(data));
  dataTransfer.effectAllowed = 'move';
}

export function readMatrixJobDragData(dataTransfer: DataTransfer): MatrixJobDragData | null {
  const raw = dataTransfer.getData(MATRIX_JOB_DRAG_TYPE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MatrixJobDragData;
  } catch {
    return null;
  }
}
