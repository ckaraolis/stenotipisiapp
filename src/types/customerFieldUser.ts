export interface CustomerFieldUserMapping {
  id: string;
  customerId: string;
  customerName: string;
  fieldName: string;
  fieldValue: string;
  fieldValueId: string | null;
  userIds: string[];
  userAliases: string[];
  usersLabel: string;
  validityFrom: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerFieldUserOption {
  id: string;
  username: string;
  fullName: string;
}

export interface CustomerFieldUserPayload {
  customerId: string;
  fieldName: string;
  fieldValue: string;
  userIds: string[];
  validityFrom: string;
}

export interface CustomerFieldUserImportRow {
  Customer?: string;
  'Field Name'?: string;
  'Field Value'?: string;
  Users?: string;
  'Validity From'?: string;
  [key: string]: string | undefined;
}

export interface CustomerFieldUserImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string; detail?: string }>;
}
