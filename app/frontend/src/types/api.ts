export interface TempSensorData {
  id: number;
  temperature: number;
  humidity: number;
  timestamp: string;
}

export interface LatestDataResponse extends TempSensorData {}

export interface HistoryDataResponse {
  data: TempSensorData[];
  limit: number;
  offset: number;
  term: number;
}

export interface HealthResponse {
  status: string;
}

export interface ApiError {
  error: string;
}

export interface HistoryParams {
  limit?: number;
  offset?: number;
  term?: number;
} 