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
  const [sensorError, setSensorError] = useState<boolean>(false);
  const [hasAttemptedRefresh, setHasAttemptedRefresh] = useState<boolean>(false);

  const STALE_DATA_THRESHOLD = 10 * 60 * 1000; // 10 minutes in milliseconds

  const isDataStale = (timestamp: string): boolean => {
    const lastUpdate = new Date(timestamp).getTime();
    const now = Date.now();
    return (now - lastUpdate) > STALE_DATA_THRESHOLD;
  };

  const fetchLatestData = async (isInitial: boolean = false, isStaleRefresh: boolean = false) => {
    try {
      if (isInitial) {
        setIsInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      setSensorError(false);
      
      const response = await TemperatureAPI.getLatestData();
      setData(response);

      // Check if the received data is still stale
      if (isDataStale(response.timestamp)) {
        if (isStaleRefresh || hasAttemptedRefresh) {
          // If this was already a refresh attempt or we've already tried once, mark as sensor error
          setSensorError(true);
          console.warn('Sensor error: Data remains stale after refresh attempt');
        } else {
          // First time detecting stale data, attempt one more refresh
          setHasAttemptedRefresh(true);
          console.warn('Stale data detected, attempting refresh...');
          setTimeout(() => {
            fetchLatestData(false, true);
          }, 1000); // Wait 1 second before retry
        }
      } else {
        // Data is fresh, reset error states
        setSensorError(false);
        setHasAttemptedRefresh(false);
      }
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

  // Background monitoring for stale data
  useEffect(() => {
    if (!data) return;

    const checkStaleData = () => {
      if (isDataStale(data.timestamp) && !hasAttemptedRefresh && !isRefreshing) {
        console.log('Background check: Stale data detected, attempting refresh...');
        fetchLatestData(false, false);
      }
    };

    // Check every 2 minutes for stale data
    const interval = setInterval(checkStaleData, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [data, hasAttemptedRefresh, isRefreshing]);

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
      </div>
      <div className="data-container">
        <div className={`sensor-value temperature ${sensorError ? 'sensor-error' : data.is_outlier ? 'outlier' : ''}`}>
          <div className="value-container">
            <span className="value">
              {data.temperature.toFixed(1)}
            </span>
            {<span className="unit">°C</span>}
          </div>
          <span className="label">
            {data.is_outlier ? 'Temperature (Outlier)' : 'Temperature'}
          </span>
          {data.ac_outlet_temperature && (
            <div className="ac-outlet-info">
              <span className="ac-outlet-label">AC Outlet:</span>
              <span className="ac-outlet-value">
                {data.ac_outlet_temperature.toFixed(1)}°C
              </span>
            </div>
          )}
        </div>
        <div className={`sensor-value humidity ${sensorError ? 'sensor-error' : data.is_outlier ? 'outlier' : ''}`}>
          <div className="value-container">
            <span className="value">
              {data.humidity.toFixed(1)}
            </span>
            {<span className="unit">%</span>}
          </div>
          <span className="label">
            {data.is_outlier ? 'Humidity (Outlier)' : 'Humidity'}
          </span>
        </div>
      </div>
      <div className="timestamp">
        Last updated: {format(new Date(data.timestamp), 'yyyy-MM-dd HH:mm:ss')}
        {sensorError && (
          <div className="sensor-error-warning" title="Sensor not responding - data is outdated">
            🔴 센서 응답 없음
          </div>
        )}
        {!sensorError && data.is_outlier && (
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