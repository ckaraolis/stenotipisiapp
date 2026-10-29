export type TranscriptType = 'steno' | 'audio';
export type TranscriptStatus = 'finished' | 'published';
export type TranscriptViewScope = 'all' | 'own' | 'assigned' | 'customer' | 'none';

export interface TranscriptFileVersion {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  uploadedByUserId?: string | null;
  uploadedByName?: string;
  description?: string;
  storageId?: string;
  hasStorage?: boolean;
}

export interface TranscriptFileEntry {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  description?: string;
  storageId?: string;
  history?: TranscriptFileVersion[];
}

export type TranscriptFileSlot =
  | 'raw_zip'
  | 'raw_transcript_timestamps'
  | 'raw_transcript'
  | 'attachment_personal_dictionary'
  | 'attachment_evidence_list'
  | 'edited_transcript'
  | 'reviewed_transcript'
  | 'other';

export type TranscriptFileGroup = 'raw' | 'attachment' | 'edited' | 'reviewed' | 'other';

export interface TranscriptFileListItem {
  rowId: string;
  slot: TranscriptFileSlot;
  group: TranscriptFileGroup;
  groupOrder: number;
  slotOrder: number;
  descriptionKey: string;
  description: string;
  fileId: string;
  name: string;
  size: number;
  uploadedAt: string;
  hasStorage: boolean;
  historyCount: number;
  isStandard: boolean;
}

export interface TranscriptFilesListView {
  transcript: TranscriptRecord;
  files: TranscriptFileListItem[];
  canManageStandard: boolean;
  canManageOther: boolean;
}

export interface TranscriptFileUploadPayload {
  name: string;
  type: string;
  contentBase64: string;
  description?: string;
}

export interface TranscriptFileUpdatePayload extends TranscriptFileUploadPayload {
  slot: TranscriptFileSlot;
  fileId: string;
  description?: string;
}

export interface TranscriptFileMutationResult {
  transcript: TranscriptRecord;
  messages: string[];
}

export interface TranscriptRawFilesBundle {
  rawZip: TranscriptFileEntry | null;
  transcriptWithTimestamps: TranscriptFileEntry | null;
  transcript: TranscriptFileEntry | null;
}

export interface TranscriptAttachmentFilesBundle {
  personalDictionary: TranscriptFileEntry | null;
  evidenceList: TranscriptFileEntry | null;
}

export interface TranscriptFilesBundle {
  rawFiles: TranscriptRawFilesBundle;
  attachmentFiles: TranscriptAttachmentFilesBundle;
  otherFiles: TranscriptFileEntry[];
  editedRawFiles: TranscriptFileEntry[];
  reviewedRawFiles: TranscriptFileEntry[];
  approvedTranscriptFile: TranscriptFileEntry | null;
}

export interface TranscriptEditDurationSegment {
  index: number;
  seconds: number;
  minutes: number;
}

export interface TranscriptSubmissionBundle {
  rawFiles?: TranscriptRawFilesBundle;
  attachmentFiles?: Record<string, TranscriptFileEntry | null>;
  otherFiles?: TranscriptFileEntry[];
  sameDayActions?: Record<string, unknown>;
  receipt?: Record<string, unknown>;
  transcriptPlainText?: string;
  transcriptTimestampsText?: string;
  transcriptCharacterCount?: number;
}

export interface TranscriptPendingCounts {
  total: number;
  completed: number;
  edited: number;
  inReview: number;
  approved: number;
}

/** §2.5 Transcript Report metrics */
export interface TranscriptReport {
  transcriptId: string;
  jobNumber: string;
  pages: number;
  billedHours: number;
  stenotypingHours: number;
  billedStenotypingLabel: string;
  tranDuration0Hours: number | null;
  stenotypingWithinSgxmlCap: boolean | null;
  editingHours: number;
  editingHoursPerPage: number | null;
  editingHoursPerBilledHour: number | null;
  reviewingHours: number;
  reviewingHoursPerPage: number | null;
  reviewingHoursPerBilledHour: number | null;
  accuracyPercent: number | null;
  deadlineMinutes: number | null;
  showDeadline: boolean;
  monthStenotypistHours: number;
  monthBilledHours: number;
  monthPagesWritten: number;
  monthStenotypistBilledLabel: string;
  monthPagesBilledLabel: string;
  pendingTranscripts: TranscriptPendingCounts;
  jobStatus: string;
  isPublished: boolean;
}

export interface TranscriptReportView {
  report: TranscriptReport;
}

/** §3 Transcripts Analysis Report row */
export interface TranscriptAnalysisRow {
  transcriptId: string;
  jobNumber: string;
  jobStatus: string;
  customerName: string;
  projectNumber: string;
  date: string;
  time: string;
  stenotypistAlias: string;
  stenotypistName: string;
  editorName: string;
  reviewerName: string;
  publisherName: string;
  expedite: boolean;
  bypassApproval: boolean;
  jobEndTime: string;
  serviceLevelAgreement: string;
  deadlineMinutes: number | null;
  deadlineLabel: string;
  eteMinutes: number;
  editDurationMinutes: number;
  editDurationLabel: string;
  transcriptOwners: string;
  pages: number;
  billedHours: number;
  stenotypingHours: number;
  billedStenotypingLabel: string;
  editingHours: number;
  editingHoursPerPage: number | null;
  editingHoursPerBilledHour: number | null;
  reviewingHours: number;
  reviewingHoursPerPage: number | null;
  reviewingHoursPerBilledHour: number | null;
  accuracyPercent: number | null;
  monthStenotypistHours: number;
  monthBilledHours: number;
  monthPagesWritten: number;
  monthStenotypistBilledLabel: string;
  monthPagesBilledLabel: string;
}

export interface TranscriptAnalysisFilterOptions {
  customers: TranscriptFilterOption[];
  statuses: string[];
}

export interface TranscriptAnalysisReportQuery {
  jobStatus?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface TranscriptAnalysisReportView {
  rows: TranscriptAnalysisRow[];
  total: number;
  filterOptions: TranscriptAnalysisFilterOptions;
  suggestedDateRange: TranscriptListDateRange;
}

/** §2.1 Transcripts Data */
export interface TranscriptRecord {
  id: string;
  jobId: string;
  jobNumber: string;
  type: TranscriptType;
  status: TranscriptStatus;
  customerId: string;
  customerName: string;
  projectId: string;
  projectNumber: string;
  date: string;
  time: string;
  stenotypistUserId: string;
  stenotypistName: string;
  stenotypistAlias: string;
  expedite: boolean;
  receiptNumberStenotypist: string;
  startTimeStenotypist: string;
  endTimeStenotypist: string;
  transcriptOwnerIds: string[];
  transcriptOwnerLabels: string[];
  pageCount: number;
  eteMinutes: number;
  editorUserId: string;
  editorName: string;
  editorRemarks: string;
  reviewerUserId: string;
  reviewerName: string;
  reviewerRemarks: string;
  publisherUserId: string;
  publisherName: string;
  publisherRemarks: string;
  editDurationMinutes: number;
  editDurationSegments: TranscriptEditDurationSegment[];
  reviewStartTime: string;
  reviewEndTime: string;
  files: TranscriptFilesBundle;
  bypassApproval: boolean;
  specialNotes: string;
  jobStatus: string;
  serviceLevelAgreement: string;
  deadlineMinutes: number | null;
  jobEndTime: string;
  submission: TranscriptSubmissionBundle;
  hasRawData: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptUpdatePayload {
  editorUserId?: string;
  reviewerUserId?: string;
  publisherUserId?: string;
  expedite?: boolean;
  bypassApproval?: boolean;
  specialNotes?: string;
  editorRemarks?: string;
  reviewerRemarks?: string;
  publisherRemarks?: string;
  reviewStartTime?: string;
  reviewEndTime?: string;
  editDurationMinutes?: number;
  sgxmlContent?: string;
  files?: Partial<TranscriptFilesBundle>;
}

export interface TranscriptParticipantCandidate {
  id: string;
  fullName: string;
  username: string;
  roles?: string[];
}

export interface TranscriptPublisherCandidate {
  id: string;
  fullName: string;
  username: string;
}

export interface TranscriptParticipantOptions {
  participants: TranscriptParticipantCandidate[];
  publishers: TranscriptPublisherCandidate[];
}

export interface TranscriptUpdateResult {
  transcript: TranscriptRecord;
  messages: string[];
}

export interface TranscriptFilterOption {
  id: string;
  name: string;
}

export interface TranscriptProjectFilterOption {
  id: string;
  label: string;
  customerId: string;
}

export interface TranscriptStenotypistFilterOption {
  id: string;
  name: string;
  alias: string;
}

export interface TranscriptListFilterOptions {
  customers: TranscriptFilterOption[];
  projects: TranscriptProjectFilterOption[];
  stenotypists: TranscriptStenotypistFilterOption[];
  editors: TranscriptFilterOption[];
  reviewers: TranscriptFilterOption[];
  transcriptOwners: TranscriptStenotypistFilterOption[];
  statuses: string[];
}

export interface TranscriptListDateRange {
  dateFrom: string;
  dateTo: string;
}

export interface TranscriptListPagination {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export interface TranscriptListView {
  viewScope: TranscriptViewScope;
  filterOptions: TranscriptListFilterOptions;
  suggestedDateRange: TranscriptListDateRange;
  transcripts: TranscriptRecord[];
  pagination: TranscriptListPagination;
}

export interface TranscriptListQuery {
  type?: TranscriptType;
  jobStatus?: string;
  customerId?: string;
  projectId?: string;
  stenotypistUserId?: string;
  editorUserId?: string;
  reviewerUserId?: string;
  transcriptOwnerUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface TranscriptWorkflowResult {
  transcript: TranscriptRecord;
  messages: string[];
}
