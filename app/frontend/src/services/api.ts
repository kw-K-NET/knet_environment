import axios, { type AxiosResponse } from 'axios';
import type { LatestDataResponse, HistoryDataResponse, HealthResponse, HistoryParams } from '../types/api';

// Configure axios instance with base URL
// The backend runs on port 38333 based on docker-compose.yml
const API_BASE_URL = 'http://localhost:38333';

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
   * Get historical temperature and humidity data
   */
  static async getHistoryData(params: HistoryParams = {}): Promise<HistoryDataResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.limit !== undefined) {
      queryParams.append('limit', params.limit.toString());
    }
    if (params.offset !== undefined) {
      queryParams.append('offset', params.offset.toString());
    }
    if (params.term !== undefined) {
      queryParams.append('term', params.term.toString());
    }

    const url = `/api/temp/history${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiClient.get<HistoryDataResponse>(url);
    return response.data;
  }
}

export default TemperatureAPI; 