export interface TempSensorData {
  id: number;
  temperature: number;
  humidity: number;
  timestamp: string;
}

export interface LatestDataResponse extends TempSensorData {}

export interface HistoryParams {
  limit?: number;
  offset?: number;
  term?: number;
  // New time-based parameters
  time_period?: '1d' | '1w' | '1m' | '1y';
  start_time?: string; // ISO 8601 format
  end_time?: string;   // ISO 8601 format
}

export interface HistoryDataResponse {
  data: TempSensorData[];
  limit: number;
  offset: number;
  term: number;
  // New time-based response fields
  time_period?: string;
  start_time?: string;
  end_time?: string;
  total_count?: number;
  returned_count?: number;
}

export interface HealthResponse {
  status: string;
}

// Time period options for UI
export interface TimePeriodOption {
  value: '1d' | '1w' | '1m' | '1y';
  label: string;
  description: string;
}

export interface ApiError {
  error: string;
} 