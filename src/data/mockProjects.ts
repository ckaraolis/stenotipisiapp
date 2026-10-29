export interface CustomerRow {
  name: string;
  alias: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  paymentTerms: string;
  priorityErpNumber: string;
  status: string;
  remarks: string;
  stenoCustomer: boolean;
}

export const mockCustomers: CustomerRow[] = [];

export interface ProjectRow {
  code: string;
  name: string;
  customer: string;
  type: string;
  status: string;
}

export const mockProjects: ProjectRow[] = [];

export interface ProjectTypeRow {
  customer: string;
  type: string;
  alias: string;
  transcriptText: string;
  status: 'enabled' | 'disabled';
}

export const mockProjectTypes: ProjectTypeRow[] = [];

export interface CustomerFieldRow {
  customer: string;
  fieldName: string;
  fieldValue: string;
  users: string;
  validityFrom: string;
}

export const mockCustomerFields: CustomerFieldRow[] = [];
