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
        <div className={`refresh-indicator ${isRefreshing ? 'visible' : 'hidden'}`} title="Refreshing data...">
          <span className="refresh-spinner">🔄</span>
        </div>
        {data.is_outlier && (
          <div className="outlier-indicator" title="Current readings may be unreliable (outlier detected)">
            ⚠️ 센서이상
          </div>
        )}
      </div>
      <div className="data-container">
        <div className={`sensor-value temperature ${data.is_outlier ? 'outlier' : ''}`}>
          <div className="value-container">
            <span className="value">
              {data.is_outlier ? '⚠️' : data.temperature.toFixed(1)}
            </span>
            {!data.is_outlier && <span className="unit">°C</span>}
          </div>
          <span className="label">
            {data.is_outlier ? 'Temperature (Outlier)' : 'Temperature'}
          </span>
        </div>
        <div className={`sensor-value humidity ${data.is_outlier ? 'outlier' : ''}`}>
          <div className="value-container">
            <span className="value">
              {data.is_outlier ? '⚠️' : data.humidity.toFixed(1)}
            </span>
            {!data.is_outlier && <span className="unit">%</span>}
          </div>
          <span className="label">
            {data.is_outlier ? 'Humidity (Outlier)' : 'Humidity'}
          </span>
        </div>
      </div>
      <div className="timestamp">
        Last updated: {format(new Date(data.timestamp), 'yyyy-MM-dd HH:mm:ss')}
        {data.is_outlier && (
          <div className="outlier-warning" title="Data may be unreliable due to outlier detection">
            ⚠️ 센서이상
          </div>
        )}
        {error && (
          <div className="error-indicator" title={error}>
            ⚠️ 새로고침을 해주세요
          </div>
        )}
      </div>
    </div>
  );
};

export default LatestDataCard; 