export interface DistrictRecord {
  id: string;
  name: string;
  greekName: string;
  alias: string;
  forScheduling: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface DistrictOption {
  id: string;
  name: string;
  greekName: string;
  alias: string;
}

export interface DistrictPayload {
  name: string;
  greekName: string;
  alias: string;
  forScheduling: boolean;
}
