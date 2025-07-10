import { useState, useEffect } from 'react';
import type { HistoryParams } from '../types/api';
import TimePeriodSelector from './TimePeriodSelector';

interface DataControlsProps {
  params: HistoryParams;
  onParamsChange: (newParams: HistoryParams) => void;
  disabled?: boolean;
}

const DataControls: React.FC<DataControlsProps> = ({ params, onParamsChange, disabled = false }) => {
  const [localParams, setLocalParams] = useState<HistoryParams>(params);

  useEffect(() => {
    setLocalParams(params);
  }, [params]);

  const handleTimePeriodChange = (period: string) => {
    const newParams: HistoryParams = {
      ...localParams,
      limit: 50, // Always 50 for time-based filtering
      time_period: period as '1d' | '1w' | '1m' | '1y',
    };
    
    setLocalParams(newParams);
    onParamsChange(newParams); // Apply immediately
  };

  const handleAggregationToggle = (enabled: boolean) => {
    const newParams: HistoryParams = {
      ...localParams,
      include_aggregates: enabled,
      // Set default window size if enabling aggregation
      aggregate_window: enabled ? (localParams.aggregate_window || 100) : undefined,
    };
    
    setLocalParams(newParams);
    onParamsChange(newParams);
  };

  const handleWindowSizeChange = (windowSize: number) => {
    const newParams: HistoryParams = {
      ...localParams,
      aggregate_window: windowSize,
    };
    
    setLocalParams(newParams);
    onParamsChange(newParams);
  };

  return (
    <div className="data-controls">    
      <div className="control-group">
        <TimePeriodSelector
          selectedPeriod={localParams.time_period || '1d'}
          onPeriodChange={handleTimePeriodChange}
          disabled={disabled}
        />
      </div>

      <div className="control-group">
        <h4>Aggregated Values</h4>
        <div className="aggregation-controls">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={localParams.include_aggregates || false}
              onChange={(e) => handleAggregationToggle(e.target.checked)}
              disabled={disabled}
            />
            <span>Show Avg/Max/Min</span>
          </label>
          
          {localParams.include_aggregates && (
            <div className="window-size-control">
              <label htmlFor="window-size">
                Window Size (±{localParams.aggregate_window || 100} points):
              </label>
              <input
                id="window-size"
                type="range"
                min="50"
                max="500"
                step="50"
                value={localParams.aggregate_window || 100}
                onChange={(e) => handleWindowSizeChange(parseInt(e.target.value))}
                disabled={disabled}
              />
              <span className="window-size-value">
                {localParams.aggregate_window || 100}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataControls; 