export interface TempSensorData {
  id: number;
  temperature: number;
  humidity: number;
  timestamp: string;
  // Aggregated values calculated from surrounding data points (±100 points)
  aggregated?: AggregatedValues;
}

export interface AggregatedValues {
  temperature?: TemperatureAggregates;
  humidity?: HumidityAggregates;
}

export interface TemperatureAggregates {
  average: number;
  maximum: number;
  minimum: number;
  count: number; // Number of data points used for calculation
}

export interface HumidityAggregates {
  average: number;
  maximum: number;
  minimum: number;
  count: number; // Number of data points used for calculation
}

export interface LatestDataResponse extends TempSensorData {}

// Enhanced to support aggregation parameters
export interface HistoryParams {
  limit: number; // Always 50 for time period mode
  time_period: '1d' | '1w' | '1m' | '1y';
  // New aggregation parameters
  include_aggregates?: boolean;
  aggregate_window?: number; // ±N points for calculation (default: 100)
}

// Enhanced response interface with aggregation metadata
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
  // New aggregation metadata
  aggregation?: AggregationMetadata;
}

export interface AggregationMetadata {
  enabled: boolean;
  window_size: number;
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

// Aggregation control options for UI
export interface AggregationOption {
  key: keyof AggregatedValues;
  label: string;
  enabled: boolean;
}

export interface ApiError {
  error: string;
} 