import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import TemperatureAPI from '../services/api';
import type { LatestDataResponse } from '../types/api';

interface LatestDataCardProps {
  refreshTrigger?: number;
}

const LatestDataCard: React.FC<LatestDataCardProps> = ({ refreshTrigger = 0 }) => {
  const [data, setData] = useState<LatestDataResponse | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLatestData = async (isInitial: boolean = false) => {
    try {
      if (isInitial) {
        setIsInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      const response = await TemperatureAPI.getLatestData();
      setData(response);
    } catch (err) {
      setError('Failed to fetch latest data');
      console.error('Error fetching latest data:', err);
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Only treat as initial loading if we don't have data yet
    fetchLatestData(data === null);
  }, [refreshTrigger]);

  // Only show loading spinner for initial load (when no data exists)
  if (isInitialLoading && !data) {
    return (
      <div className="latest-data-card loading">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="latest-data-card error">
        <div className="error-message">{error}</div>
        <button onClick={() => fetchLatestData(true)} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="latest-data-card">
        <div className="no-data">No data available</div>
      </div>
    );
  }

  return (
    <div className="latest-data-card">
      <div className="card-header">
        {isRefreshing && (
          <div className="refresh-indicator" title="Refreshing data...">
            <span className="refresh-spinner">🔄</span>
          </div>
        )}
      </div>
      <div className="data-container">
        <div className="sensor-value temperature">
          <div className="value-container">
            <span className="value">{data.temperature.toFixed(1)}</span>
            <span className="unit">°C</span>
          </div>
          <span className="label">Temperature</span>
        </div>
        <div className="sensor-value humidity">
          <div className="value-container">
            <span className="value">{data.humidity.toFixed(1)}</span>
            <span className="unit">%</span>
          </div>
          <span className="label">Humidity</span>
        </div>
      </div>
      <div className="timestamp">
        Last updated: {format(new Date(data.timestamp), 'yyyy-MM-dd HH:mm:ss')}
        {error && (
          <div className="error-indicator" title={error}>
            ⚠️ Update failed
          </div>
        )}
      </div>
    </div>
  );
};

export default LatestDataCard; 