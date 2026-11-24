export interface ProjectTypeRecord {
  id: string;
  customerId: string;
  customerName: string;
  type: string;
  alias: string;
  transcriptText: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTypeOption {
  id: string;
  customerId: string;
  customerName: string;
  type: string;
  alias: string;
  transcriptText: string;
  enabled: boolean;
}

export interface ProjectTypePayload {
  customerId: string;
  type: string;
  alias: string;
  transcriptText: string;
  enabled: boolean;
}

export interface ProjectTypeImportRow {
  Customer?: string;
  Type?: string;
  Alias?: string;
  'Transcript Text'?: string;
  Status?: string;
  [key: string]: string | undefined;
}

export interface ProjectTypeImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}
