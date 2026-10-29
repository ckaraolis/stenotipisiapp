import type { MatrixCellEntry } from '../data/mockJobAllocation';

export interface JobMatrixMetrics {
  m1: string;
  m2: string;
  m3: string;
  m4: string;
  m5: string;
  m6: string;
  m7: string;
  m8: string;
  m8Late: boolean;
  m9: string;
}

export interface JobMatrixStenotypistInfo {
  id: string;
  alias: string;
  fullName: string;
  email: string;
  contactPhone: string;
  mobilePhone: string;
  laptopSerialNumber: string;
  stenotypeMachineSerialNumber: string;
  catalystProductKey: string;
}

export interface JobMatrixStenotypistRow {
  id: string;
  alias: string;
  fullName: string;
  metrics: JobMatrixMetrics;
  info: JobMatrixStenotypistInfo;
  schedule: Record<string, MatrixCellEntry[]>;
}

export interface JobMatrixUnassignedJob {
  id: string;
  title: string;
  time: string;
  customerAlias: string;
  district: string;
  projectField1: string;
  projectField2: string;
  projectField3: string;
  date: string;
  jobStatus: string;
}

export interface JobMatrixView {
  centerDate: string;
  stenotypists: JobMatrixStenotypistRow[];
  unassignedJobs: JobMatrixUnassignedJob[];
}
