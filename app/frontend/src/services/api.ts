import axios, { type AxiosResponse } from 'axios';
import type { LatestDataResponse, HistoryDataResponse, HealthResponse, HistoryParams } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export class TemperatureAPI {
  /**
   * Check API health status
   */
  static async checkHealth(): Promise<HealthResponse> {
    const response = await apiClient.get<HealthResponse>('/health');
    return response.data;
  }

  /**
   * Get the latest temperature and humidity data
   */
  static async getLatestData(): Promise<LatestDataResponse> {
    const response = await apiClient.get<LatestDataResponse>('/api/temp/latest');
    return response.data;
  }

  /**
   * Get historical temperature and humidity data using time period mode
   */
  static async getHistoryData(params: HistoryParams): Promise<HistoryDataResponse> {
    const queryParams = new URLSearchParams();
    
    // Always include limit and time_period (simplified API)
    queryParams.append('limit', params.limit.toString());
    queryParams.append('time_period', params.time_period);

    // Add aggregation parameters if specified
    if (params.include_aggregates !== undefined) {
      queryParams.append('include_aggregates', params.include_aggregates.toString());
    }
    
    if (params.aggregate_window !== undefined) {
      queryParams.append('aggregate_window', params.aggregate_window.toString());
    }

    const url = `/api/temp/history?${queryParams.toString()}`;
    const response = await apiClient.get<HistoryDataResponse>(url);
    return response.data;
  }
}

export default TemperatureAPI; 