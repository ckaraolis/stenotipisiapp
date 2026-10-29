export interface TravellingChargeRecord {
  id: string;
  customerId: string;
  customerName: string;
  customerAlias: string;
  districtId: string;
  districtName: string;
  districtAlias: string;
  amount: number;
  validityFrom: string;
  createdAt: string;
  updatedAt: string;
}

export interface TravellingChargePayload {
  customerId: string;
  districtId: string;
  amount: number;
  validityFrom: string;
}

export interface TravellingChargeListQuery {
  customerId?: string;
  districtId?: string;
  dateFrom?: string;
  dateTo?: string;
}
