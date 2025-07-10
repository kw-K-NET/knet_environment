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
  temperature: number | null;
  humidity: number | null;
  // Aggregated values
  tempAvg?: number | null;
  tempMax?: number | null;
  tempMin?: number | null;
  humidityAvg?: number | null;
  humidityMax?: number | null;
  humidityMin?: number | null;
  aggregateCount?: number; // Number of points used for aggregation
}

const HistoryChart: React.FC<HistoryChartProps> = ({ params, refreshTrigger = 0 }) => {
  const [data, setData] = useState<ChartData[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [responseInfo, setResponseInfo] = useState<Omit<HistoryDataResponse, 'data'> | null>(null);

  const getTimeFormat = (timePeriod?: string): string => {
    switch (timePeriod) {
      case '1d': return 'HH:mm';           // Hours and minutes for 1 day
      case '1w': return 'MM/dd HH:mm';     // Month/day and time for 1 week  
      case '1m': return 'MM/dd';           // Month/day for 1 month
      case '1y': return 'yyyy/MM';         // Year/month for 1 year
      default: return 'MM/dd HH:mm';       // Default format
    }
  };

  const transformDataForChart = (sensorData: TempSensorData[]): ChartData[] => {
    if (sensorData.length === 0) {
      return [];
    }

    // Sort data by timestamp to ensure proper ordering
    const sortedData = [...sensorData].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const timeFormat = getTimeFormat(params.time_period);

    // For time-based filtering, handle null data points and format appropriately
    if (params.time_period) {
      return sortedData.map(item => {
        // Backend sends ID=0 for null data points
        const isNullData = item.id === 0;
        
        const chartData: ChartData = {
          timestamp: item.timestamp,
          formattedTime: format(new Date(item.timestamp), timeFormat),
          temperature: isNullData ? null : Number(item.temperature.toFixed(1)),
          humidity: isNullData ? null : Number(item.humidity.toFixed(1)),
        };

        // Add aggregated values if available
        if (item.aggregated && !isNullData) {
          if (item.aggregated.temperature) {
            chartData.tempAvg = Number(item.aggregated.temperature.average.toFixed(1));
            chartData.tempMax = Number(item.aggregated.temperature.maximum.toFixed(1));
            chartData.tempMin = Number(item.aggregated.temperature.minimum.toFixed(1));
          }
          if (item.aggregated.humidity) {
            chartData.humidityAvg = Number(item.aggregated.humidity.average.toFixed(1));
            chartData.humidityMax = Number(item.aggregated.humidity.maximum.toFixed(1));
            chartData.humidityMin = Number(item.aggregated.humidity.minimum.toFixed(1));
            chartData.aggregateCount = item.aggregated.humidity.count; // Use humidity count as reference
          }
        }

        return chartData;
      });
    }

    // For traditional filtering, use the existing gap-filling logic
    // Calculate the most common interval between consecutive data points
    const intervals: number[] = [];
    for (let i = 1; i < sortedData.length; i++) {
      const interval = new Date(sortedData[i].timestamp).getTime() - 
                      new Date(sortedData[i-1].timestamp).getTime();
      intervals.push(interval);
    }

    // Determine expected interval (use median to handle outliers)
    let expectedInterval = 60000; // Default to 1 minute
    if (intervals.length > 0) {
      intervals.sort((a, b) => a - b);
      const median = intervals[Math.floor(intervals.length / 2)];
      // Use the median but ensure it's reasonable (between 10 seconds and 1 hour)
      expectedInterval = Math.max(10000, Math.min(3600000, median));
    }

    // Create a map of existing data points for quick lookup
    const dataMap = new Map<string, TempSensorData>();
    sortedData.forEach(item => {
      const key = new Date(item.timestamp).getTime().toString();
      dataMap.set(key, item);
    });

    // Generate complete time series from first to last timestamp
    const startTime = new Date(sortedData[0].timestamp).getTime();
    const endTime = new Date(sortedData[sortedData.length - 1].timestamp).getTime();
    
    const completeTimeSeries: ChartData[] = [];
    
    for (let time = startTime; time <= endTime; time += expectedInterval) {
      const timestamp = new Date(time).toISOString();
      const timeKey = time.toString();
      const existingData = dataMap.get(timeKey);
      
      // Look for data within a tolerance window (half the expected interval)
      let foundData = existingData;
      if (!foundData) {
        const tolerance = expectedInterval / 2;
        for (const [key, data] of dataMap.entries()) {
          const dataTime = parseInt(key);
          if (Math.abs(dataTime - time) <= tolerance) {
            foundData = data;
            break;
          }
        }
      }

      if (foundData) {
        completeTimeSeries.push({
          timestamp: foundData.timestamp,
          formattedTime: format(new Date(foundData.timestamp), timeFormat),
          temperature: Number(foundData.temperature.toFixed(1)),
          humidity: Number(foundData.humidity.toFixed(1)),
        });
      } else {
        // Insert null values for missing data points
        completeTimeSeries.push({
          timestamp,
          formattedTime: format(new Date(timestamp), timeFormat),
          temperature: null,
          humidity: null,
        });
      }
    }

    return completeTimeSeries;
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
        time_period: response.time_period,
        start_time: response.start_time,
        end_time: response.end_time,
        total_count: response.total_count,
        returned_count: response.returned_count,
        aggregation: response.aggregation,
      });
      console.log(responseInfo);
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
  }, [params.limit, params.time_period, refreshTrigger]);

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Get the data point to access aggregated values
      const dataPoint = payload[0]?.payload;
      
      // Check if both values are null (missing data point)
      const tempValue = payload.find((p: any) => p.dataKey === 'temperature')?.value;
      const humidityValue = payload.find((p: any) => p.dataKey === 'humidity')?.value;
      
      if (tempValue === null && humidityValue === null) {
        return (
          <div className="chart-tooltip">
            <p className="tooltip-label">{`Time: ${label}`}</p>
            <p className="tooltip-missing" style={{ color: '#9ca3af', fontStyle: 'italic' }}>
              No data available
            </p>
          </div>
        );
      }
      
      const hasAggregatedData = dataPoint?.tempAvg !== undefined || dataPoint?.humidityAvg !== undefined;
      
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{`Time: ${label}`}</p>
          
          {/* Main values */}
          <p className="tooltip-temp" style={{ color: '#8884d8' }}>
            {tempValue !== null ? `Temperature: ${tempValue}°C` : 'Temperature: No data'}
          </p>
          <p className="tooltip-humidity" style={{ color: '#82ca9d' }}>
            {humidityValue !== null ? `Humidity: ${humidityValue}%` : 'Humidity: No data'}
          </p>
          
          {/* Aggregated values if available */}
          {hasAggregatedData && (
            <div className="tooltip-aggregated" style={{ marginTop: '8px', borderTop: '1px solid #ccc', paddingTop: '8px' }}>
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                Aggregated ({dataPoint.aggregateCount} points):
              </p>
              
              {dataPoint?.tempAvg !== undefined && (
                <div style={{ fontSize: '11px', color: '#8884d8' }}>
                  <p>Temp Avg: {dataPoint.tempAvg}°C</p>
                  <p>Temp Max: {dataPoint.tempMax}°C</p>
                  <p>Temp Min: {dataPoint.tempMin}°C</p>
                </div>
              )}
              
              {dataPoint?.humidityAvg !== undefined && (
                <div style={{ fontSize: '11px', color: '#82ca9d' }}>
                  <p>Humidity Avg: {dataPoint.humidityAvg}%</p>
                  <p>Humidity Max: {dataPoint.humidityMax}%</p>
                  <p>Humidity Min: {dataPoint.humidityMin}%</p>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const calculateYAxisRanges = () => {
    // Default ranges
    const defaultTempRange = { min: 10, max: 40 };
    const defaultHumidityRange = { min: 20, max: 80 };
    
    // Filter out null values and get actual data
    const validData = data.filter(d => d.temperature !== null && d.humidity !== null);
    
    if (validData.length === 0) {
      // No valid data, use default ranges
      return {
        temperature: [defaultTempRange.min, defaultTempRange.max],
        humidity: [defaultHumidityRange.min, defaultHumidityRange.max]
      };
    }
    
    // Find actual min/max values in the data, including aggregated values
    const temperatures = validData.map(d => d.temperature!);
    const humidities = validData.map(d => d.humidity!);
    
    // Include aggregated values in range calculation if available
    validData.forEach(d => {
      if (d.tempMax !== undefined && d.tempMax !== null) temperatures.push(d.tempMax);
      if (d.tempMin !== undefined && d.tempMin !== null) temperatures.push(d.tempMin);
      if (d.humidityMax !== undefined && d.humidityMax !== null) humidities.push(d.humidityMax);
      if (d.humidityMin !== undefined && d.humidityMin !== null) humidities.push(d.humidityMin);
    });
    
    const actualTempMin = Math.min(...temperatures);
    const actualTempMax = Math.max(...temperatures);
    const actualHumidityMin = Math.min(...humidities);
    const actualHumidityMax = Math.max(...humidities);
    
    // Calculate temperature range
    let tempMin = defaultTempRange.min;
    let tempMax = defaultTempRange.max;
    
    if (actualTempMin < defaultTempRange.min) {
      // Expand below default range by 10%
      tempMin = actualTempMin - (Math.abs(actualTempMin) * 0.1);
    }
    
    if (actualTempMax > defaultTempRange.max) {
      // Expand above default range by 10%
      tempMax = actualTempMax + (Math.abs(actualTempMax) * 0.1);
    }
    
    // Calculate humidity range
    let humidityMin = defaultHumidityRange.min;
    let humidityMax = defaultHumidityRange.max;
    
    if (actualHumidityMin < defaultHumidityRange.min) {
      // Expand below default range by 10%, but never go below 0
      humidityMin = Math.max(0, actualHumidityMin - (Math.abs(actualHumidityMin) * 0.1));
    }
    
    if (actualHumidityMax > defaultHumidityRange.max) {
      // Expand above default range by 10%, but never go above 100
      humidityMax = Math.min(100, actualHumidityMax + (Math.abs(actualHumidityMax) * 0.1));
    }
    
    return {
      temperature: [Math.round(tempMin), Math.round(tempMax)],
      humidity: [Math.round(humidityMin), Math.round(humidityMax)]
    };
  };

  const getXAxisInterval = () => {
    // Calculate appropriate interval based on data length and time period
    if (data.length <= 10) return 0; // Show all labels for small datasets
    
    switch (params.time_period) {
      case '1d': return Math.ceil(data.length / 6);  // ~6 labels for 1 day
      case '1w': return Math.ceil(data.length / 7);  // ~7 labels for 1 week
      case '1m': return Math.ceil(data.length / 8);  // ~8 labels for 1 month
      case '1y': return Math.ceil(data.length / 12); // ~12 labels for 1 year
      default: return Math.ceil(data.length / 8);    // Default ~8 labels
    }
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

  // Calculate Y-axis ranges once for both axes
  const yAxisRanges = calculateYAxisRanges();

  return (
    <div className="history-chart">
      <div className="chart-header">
        <div className="chart-header-left">
          <h2>Historical Data</h2>
        </div>
        <div className="chart-header-right">
          {isRefreshing && (
            <div className="refresh-indicator" title="Refreshing data...">
              <span className="refresh-spinner">🔄</span>
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
              interval={getXAxisInterval()}
              angle={params.time_period === '1d' ? 0 : -45}
              textAnchor={params.time_period === '1d' ? 'middle' : 'end'}
              height={params.time_period === '1d' ? 60 : 80}
            />
            <YAxis 
              yAxisId="temperature"
              orientation="left"
              domain={yAxisRanges.temperature}
              tick={{ fontSize: 12 }}
              label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
            />
            <YAxis 
              yAxisId="humidity"
              orientation="right"
              domain={yAxisRanges.humidity}
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
              connectNulls={false}
            />
            <Line
              yAxisId="humidity"
              type="monotone"
              dataKey="humidity"
              stroke="#82ca9d"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Humidity (%)"
              connectNulls={false}
            />
            
            {/* Aggregated Lines - Only show if aggregation is enabled */}
            {params.include_aggregates && (
              <>
                {/* Temperature Aggregated Lines */}
                <Line
                  yAxisId="temperature"
                  type="monotone"
                  dataKey="tempAvg"
                  stroke="#6366f1"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Temp Average"
                  connectNulls={false}
                />
                <Line
                  yAxisId="temperature"
                  type="monotone"
                  dataKey="tempMax"
                  stroke="#ef4444"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  dot={false}
                  name="Temp Maximum"
                  connectNulls={false}
                />
                <Line
                  yAxisId="temperature"
                  type="monotone"
                  dataKey="tempMin"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  dot={false}
                  name="Temp Minimum"
                  connectNulls={false}
                />
                
                {/* Humidity Aggregated Lines */}
                <Line
                  yAxisId="humidity"
                  type="monotone"
                  dataKey="humidityAvg"
                  stroke="#059669"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Humidity Average"
                  connectNulls={false}
                />
                <Line
                  yAxisId="humidity"
                  type="monotone"
                  dataKey="humidityMax"
                  stroke="#dc2626"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  dot={false}
                  name="Humidity Maximum"
                  connectNulls={false}
                />
                <Line
                  yAxisId="humidity"
                  type="monotone"
                  dataKey="humidityMin"
                  stroke="#2563eb"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  dot={false}
                  name="Humidity Minimum"
                  connectNulls={false}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default HistoryChart; 