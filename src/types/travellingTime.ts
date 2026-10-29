export interface TravellingTimeRecord {
  id: string;
  district1Id: string;
  district1Name: string;
  district1Alias: string;
  district2Id: string;
  district2Name: string;
  district2Alias: string;
  travellingTime: number;
  validityFrom: string;
  createdAt: string;
  updatedAt: string;
}

export interface TravellingTimePayload {
  district1Id: string;
  district2Id: string;
  travellingTime: number;
  validityFrom: string;
}
