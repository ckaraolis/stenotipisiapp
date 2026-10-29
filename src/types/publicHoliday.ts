export interface PublicHolidayRecord {
  id: string;
  name: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicHolidayPayload {
  name: string;
  date: string;
}
