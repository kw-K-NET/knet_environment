import { useState, useEffect, useCallback } from 'react';
import LatestDataCard from './LatestDataCard';
import HistoryChart from './HistoryChart';
import DataControls from './DataControls';
import TemperatureAPI from '../services/api';
import type { HistoryParams } from '../types/api';

const Dashboard: React.FC = () => {
  const [historyParams, setHistoryParams] = useState<HistoryParams>({
    limit: 50,
    time_period: '1d', // Default to 1 day time period
  });
  
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(30); // seconds
  const [apiHealth, setApiHealth] = useState<boolean | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
      setLastRefresh(new Date());
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Check API health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await TemperatureAPI.checkHealth();
        setApiHealth(true);
      } catch (error) {
        setApiHealth(false);
        console.error('API health check failed:', error);
      }
    };

    checkHealth();
  }, []);

  const handleManualRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    setLastRefresh(new Date());
  }, []);

  const handleParamsChange = useCallback((newParams: HistoryParams) => {
    setHistoryParams(newParams);
  }, []);

  const handleAutoRefreshToggle = useCallback(() => {
    setAutoRefresh(prev => !prev);
  }, []);

  const handleIntervalChange = useCallback((interval: number) => {
    setRefreshInterval(interval);
  }, []);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Temperature & Humidity Monitoring Dashboard</h1>
        
        <div className="dashboard-controls">
          <div className="api-status">
            <span className={`status-indicator ${apiHealth === true ? 'healthy' : apiHealth === false ? 'error' : 'unknown'}`}>
              {apiHealth === true ? '🟢' : apiHealth === false ? '🔴' : '🟡'}
            </span>
            <span>API Status: {apiHealth === true ? 'Healthy' : apiHealth === false ? 'Error' : 'Checking...'}</span>
          </div>

          <div className="refresh-controls">
            <button
              onClick={handleManualRefresh}
              className="refresh-btn"
              title="Refresh data manually"
            >
              Refresh
            </button>
            
            <label className="auto-refresh-control">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={handleAutoRefreshToggle}
              />
              Auto-refresh
            </label>

            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => handleIntervalChange(Number(e.target.value))}
                className="interval-select"
              >
                <option value={30}>30s</option>
                <option value={60}>1m</option>
                <option value={300}>5m</option>
              </select>
            )}
          </div>

          <div className="last-refresh">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="dashboard-grid">
          {/* Latest Data Section */}
          <section className="latest-section">
            <LatestDataCard refreshTrigger={refreshTrigger} />
          </section>

          {/* Controls Section */}
          <aside className="controls-section">
            <DataControls
              params={historyParams}
              onParamsChange={handleParamsChange}
              disabled={false}
            />
          </aside>

          {/* Chart Section */}
          <section className="chart-section">
            <HistoryChart
              params={historyParams}
              refreshTrigger={refreshTrigger}
            />
          </section>
        </div>
      </main>

      <footer className="dashboard-footer">
        <div className="footer-info">
          <span>K-NET Environment Monitoring System</span>
          <span>Backend API: {window.location.hostname}/api/</span>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard; 