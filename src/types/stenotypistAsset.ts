export interface StenotypistAsset {
  id: string;
  stenotypistId: string;
  stenotypistName: string;
  stenotypistUsername: string;
  laptopSerialNumber: string;
  stenotypeMachineSerialNumber: string;
  catalystProductKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface StenotypistAssetPayload {
  stenotypistId: string;
  laptopSerialNumber: string;
  stenotypeMachineSerialNumber: string;
  catalystProductKey: string;
}
