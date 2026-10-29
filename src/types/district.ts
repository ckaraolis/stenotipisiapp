export interface DistrictRecord {
  id: string;
  name: string;
  alias: string;
  enabled: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface DistrictOption {
  id: string;
  name: string;
  alias: string;
}

export interface DistrictPayload {
  name: string;
  alias: string;
}
