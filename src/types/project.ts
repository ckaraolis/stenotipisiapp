import type { TravellingCharges } from './customer';

export const PROJECT_STATUS_OPTIONS = ['open', 'closed'] as const;

export type ProjectStatus = (typeof PROJECT_STATUS_OPTIONS)[number];

export interface ProjectTranscriptOwner {
  id: string;
  fullName: string;
  email: string;
  username: string;
}

export interface ProjectRecord {
  id: string;
  projectNumber: string;
  customerId: string;
  customerName: string;
  customerAlias: string;
  districtId: string;
  districtName: string;
  districtAlias: string;
  field1ValueId: string | null;
  field1Value: string;
  field1Name: string;
  field2ValueId: string | null;
  field2Value: string;
  field2Name: string;
  field3: string;
  field3Name: string;
  field4: string;
  field4Name: string;
  travellingCharges: TravellingCharges;
  status: ProjectStatus;
  transcriptOwnerIds: string[];
  transcriptOwners: ProjectTranscriptOwner[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPayload {
  customerId: string;
  districtId: string;
  field1ValueId?: string | null;
  field2ValueId?: string | null;
  field3?: string;
  field4?: string;
  travellingCharges?: TravellingCharges | string;
  status?: ProjectStatus | string;
  transcriptOwnerIds?: string[];
}
