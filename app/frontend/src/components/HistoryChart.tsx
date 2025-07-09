import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import TemperatureAPI from '../services/api';
import type { HistoryDataResponse, HistoryParams, TempSensorData } from '../types/api';

interface HistoryChartProps {
  params: HistoryParams;
  refreshTrigger?: number;
}

interface ChartData {
  timestamp: string;
  formattedTime: string;
  temperature: number;
  humidity: number;
}

const HistoryChart: React.FC<HistoryChartProps> = ({ params, refreshTrigger = 0 }) => {
  const [data, setData] = useState<ChartData[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [responseInfo, setResponseInfo] = useState<Omit<HistoryDataResponse, 'data'> | null>(null);

  const transformDataForChart = (sensorData: TempSensorData[]): ChartData[] => {
    return sensorData.map((item) => ({
      timestamp: item.timestamp,
      formattedTime: format(new Date(item.timestamp), 'MM/dd HH:mm'),
      temperature: Number(item.temperature.toFixed(1)),
      humidity: Number(item.humidity.toFixed(1)),
    })).reverse(); // Reverse to show oldest first (left to right)
  };

  const fetchHistoryData = async (isInitial: boolean = false) => {
    try {
      if (isInitial) {
        setIsInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      const response = await TemperatureAPI.getHistoryData(params);
      
      const chartData = transformDataForChart(response.data);
      setData(chartData);
      setResponseInfo({
        limit: response.limit,
        offset: response.offset,
        term: response.term,
      });
    } catch (err) {
      setError('Failed to fetch historical data');
      console.error('Error fetching historical data:', err);
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Only treat as initial loading if we don't have data yet
    fetchHistoryData(data.length === 0);
  }, [params.limit, params.offset, params.term, refreshTrigger]);

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{`Time: ${label}`}</p>
          <p className="tooltip-temp" style={{ color: '#8884d8' }}>
            {`Temperature: ${payload[0].value}°C`}
          </p>
          <p className="tooltip-humidity" style={{ color: '#82ca9d' }}>
            {`Humidity: ${payload[1].value}%`}
          </p>
        </div>
      );
    }
    return null;
  };

  // Only show loading spinner for initial load (when no data exists)
  if (isInitialLoading && data.length === 0) {
    return (
      <div className="history-chart loading">
        <h2>Historical Data</h2>
        <div className="loading-spinner">Loading chart...</div>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="history-chart error">
        <h2>Historical Data</h2>
        <div className="error-message">{error}</div>
        <button onClick={() => fetchHistoryData(true)} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="history-chart">
        <h2>Historical Data</h2>
        <div className="no-data">No historical data available</div>
      </div>
    );
  }

  return (
    <div className="history-chart">
      <div className="chart-header">
        <h2>Historical Data</h2>
        <div className="chart-header-right">
          {isRefreshing && (
            <div className="refresh-indicator" title="Refreshing data...">
              <span className="refresh-spinner">🔄</span>
            </div>
          )}
          {responseInfo && (
            <div className="chart-info">
              <span>Records: {data.length}</span>
              <span>Limit: {responseInfo.limit}</span>
              {responseInfo.term > 0 && <span>Interval: {responseInfo.term}</span>}
              {responseInfo.term === 0 && <span>Offset: {responseInfo.offset}</span>}
            </div>
          )}
        </div>
      </div>
      
      {error && (
        <div className="chart-error-indicator" title={error}>
          ⚠️ Update failed - showing previous data
        </div>
      )}
      
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="formattedTime" 
              tick={{ fontSize: 12 }}
              interval={Math.ceil(data.length / 8)} // Show ~8 labels max
            />
            <YAxis 
              yAxisId="temperature"
              orientation="left"
              domain={['dataMin - 2', 'dataMax + 2']}
              tick={{ fontSize: 12 }}
              label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
            />
            <YAxis 
              yAxisId="humidity"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              label={{ value: 'Humidity (%)', angle: 90, position: 'insideRight' }}
            />
            <Tooltip content={customTooltip} />
            <Legend />
            <Line
              yAxisId="temperature"
              type="monotone"
              dataKey="temperature"
              stroke="#8884d8"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Temperature (°C)"
            />
            <Line
              yAxisId="humidity"
              type="monotone"
              dataKey="humidity"
              stroke="#82ca9d"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Humidity (%)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default HistoryChart; 