import { useState, useEffect, useCallback } from 'react';
import LatestDataCard from './LatestDataCard';
import HistoryChart from './HistoryChart';
import DataControls from './DataControls';
import type { HistoryParams } from '../types/api';

const Dashboard: React.FC = () => {
  // Always use time period mode with default 1 day
  const [historyParams, setHistoryParams] = useState<HistoryParams>({
    limit: 50,
    time_period: '1d',
  });
  
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [autoRefresh] = useState<boolean>(true);
  const [refreshInterval] = useState<number>(30); // seconds
  const [, setLastRefresh] = useState<Date>(new Date());

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
      setLastRefresh(new Date());
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const handleParamsChange = useCallback((newParams: HistoryParams) => {
    // Ensure we only accept time period parameters
    const sanitizedParams: HistoryParams = {
      limit: 50, // Always 50 for time period mode
      time_period: newParams.time_period || '1d',
    };
    setHistoryParams(sanitizedParams);
  }, []);

  return (
    <div className="dashboard">
      <main className="dashboard-content">
        <div className="dashboard-grid">
          {/* Latest Data Section */}
          <section className="latest-section">
            <LatestDataCard refreshTrigger={refreshTrigger} />
          </section>

          {/* Time Period Controls Section */}
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
          <a 
            href="https://github.com/kw-K-NET/knet_environment" 
            target="_blank" 
            rel="noopener noreferrer"
            className="github-link"
            title="View source code on GitHub"
          >
            <svg className="github-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.300 24 12c0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard; 