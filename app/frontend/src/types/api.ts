export interface TempSensorData {
  id: number;
  temperature: number;
  humidity: number;
  timestamp: string;
}

export interface LatestDataResponse extends TempSensorData {}

// Simplified to only support time period mode
export interface HistoryParams {
  limit: number; // Always 50 for time period mode
  time_period: '1d' | '1w' | '1m' | '1y';
}

// Keep full response interface for backend compatibility
export interface HistoryDataResponse {
  data: TempSensorData[];
  limit: number;
  offset: number;
  term: number;
  // Time-based response fields (primary)
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