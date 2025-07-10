import { useState, useEffect } from 'react';
import type { HistoryParams } from '../types/api';
import TimePeriodSelector from './TimePeriodSelector';

interface DataControlsProps {
  params: HistoryParams;
  onParamsChange: (newParams: HistoryParams) => void;
  disabled?: boolean;
}

type FilterMode = 'time' | 'offset' | 'term';

const DataControls: React.FC<DataControlsProps> = ({ params, onParamsChange, disabled = false }) => {
  const [localParams, setLocalParams] = useState<HistoryParams>(params);
  const [filterMode, setFilterMode] = useState<FilterMode>(() => {
    if (params.time_period) return 'time';
    if (params.term && params.term > 0) return 'term';
    return 'offset';
  });

  useEffect(() => {
    setLocalParams(params);
    // Update filter mode based on params
    if (params.time_period) {
      setFilterMode('time');
    } else if (params.term && params.term > 0) {
      setFilterMode('term');
    } else {
      setFilterMode('offset');
    }
  }, [params]);

  const handleInputChange = (field: keyof HistoryParams, value: string) => {
    const numValue = value === '' ? undefined : parseInt(value, 10);
    
    if (numValue !== undefined && (isNaN(numValue) || numValue < 0)) {
      return; // Invalid input, ignore
    }

    const newParams = {
      ...localParams,
      [field]: numValue,
    };

    setLocalParams(newParams);
  };

  const handleModeChange = (mode: FilterMode) => {
    setFilterMode(mode);
    
    const newParams = { ...localParams };
    
    // Clear all mode-specific parameters
    delete newParams.time_period;
    delete newParams.start_time;
    delete newParams.end_time;
    newParams.offset = 0;
    newParams.term = 0;

    if (mode === 'time') {
      // Set default time period
      newParams.time_period = '1d';
      newParams.limit = 50; // Fixed for time mode
    } else if (mode === 'term') {
      newParams.term = 5; // Default term value
      newParams.offset = 0;
    } else {
      // offset mode
      newParams.offset = 0;
      newParams.term = 0;
    }
    
    setLocalParams(newParams);
    onParamsChange(newParams);
  };

  const handleTimePeriodChange = (period: string) => {
    const newParams = {
      ...localParams,
      time_period: period as '1d' | '1w' | '1m' | '1y',
      limit: 50, // Always 50 for time-based filtering
    };
    
    // Clear other time parameters when using preset period
    delete newParams.start_time;
    delete newParams.end_time;
    
    setLocalParams(newParams);
    onParamsChange(newParams); // Apply immediately for time mode
  };

  const handleApply = () => {
    onParamsChange(localParams);
  };

  const handleReset = () => {
    const defaultParams: HistoryParams = {
      limit: 50,
      time_period: '1d',
    };
    setLocalParams(defaultParams);
    setFilterMode('time');
    onParamsChange(defaultParams);
  };

  const isChanged = JSON.stringify(localParams) !== JSON.stringify(params);

  return (
    <div className="data-controls">
      <h3>Data Filters</h3>
      
      {/* Filter Mode Selection */}
      <div className="control-group mode-selector">
        <label>Filter Mode:</label>
        <div className="radio-group">
          <label className="radio-label">
            <input
              type="radio"
              name="filterMode"
              checked={filterMode === 'time'}
              onChange={() => handleModeChange('time')}
              disabled={disabled}
            />
            <div className="mode-info">
              <span>Time Period</span>
              <small>Fixed 50 points across time range</small>
            </div>
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="filterMode"
              checked={filterMode === 'offset'}
              onChange={() => handleModeChange('offset')}
              disabled={disabled}
            />
            <div className="mode-info">
              <span>Pagination</span>
              <small>Skip records with offset</small>
            </div>
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="filterMode"
              checked={filterMode === 'term'}
              onChange={() => handleModeChange('term')}
              disabled={disabled}
            />
            <div className="mode-info">
              <span>Interval Sampling</span>
              <small>Every Nth record</small>
            </div>
          </label>
        </div>
      </div>

      {/* Time Period Selection */}
      {filterMode === 'time' && (
        <div className="control-group">
          <TimePeriodSelector
            selectedPeriod={localParams.time_period || '1d'}
            onPeriodChange={handleTimePeriodChange}
            disabled={disabled}
          />
        </div>
      )}

      {/* Limit Control - Only for non-time modes */}
      {filterMode !== 'time' && (
        <div className="control-group">
          <label htmlFor="limit">
            Limit:
            <span className="control-description">Number of records (max: 1000)</span>
          </label>
          <input
            id="limit"
            type="number"
            min="1"
            max="1000"
            value={localParams.limit || ''}
            onChange={(e) => handleInputChange('limit', e.target.value)}
            disabled={disabled}
            placeholder="50"
          />
        </div>
      )}

      {/* Offset Control */}
      {filterMode === 'offset' && (
        <div className="control-group">
          <label htmlFor="offset">
            Offset:
            <span className="control-description">Skip this many records</span>
          </label>
          <input
            id="offset"
            type="number"
            min="0"
            value={localParams.offset || ''}
            onChange={(e) => handleInputChange('offset', e.target.value)}
            disabled={disabled}
            placeholder="0"
          />
        </div>
      )}

      {/* Term Control */}
      {filterMode === 'term' && (
        <div className="control-group">
          <label htmlFor="term">
            Term:
            <span className="control-description">Interval between records</span>
          </label>
          <input
            id="term"
            type="number"
            min="1"
            value={localParams.term || ''}
            onChange={(e) => handleInputChange('term', e.target.value)}
            disabled={disabled}
            placeholder="5"
          />
        </div>
      )}

      {/* Control Actions - Only show for non-time modes */}
      {filterMode !== 'time' && (
        <div className="control-actions">
          <button
            onClick={handleApply}
            disabled={disabled || !isChanged}
            className="apply-btn"
          >
            Apply Filters
          </button>
          <button
            onClick={handleReset}
            disabled={disabled}
            className="reset-btn"
          >
            Reset
          </button>
        </div>
      )}

      {/* Current Parameters Display */}
      <div className="current-params">
        <h4>Current Parameters:</h4>
        <div className="params-display">
          {filterMode === 'time' ? (
            <>
              <span>Mode: Time Period</span>
              <span>Period: {params.time_period || '1d'}</span>
              <span>Points: 50 (fixed)</span>
            </>
          ) : (
            <>
              <span>Limit: {params.limit || 50}</span>
              {params.term && params.term > 0 ? (
                <span>Term: {params.term}</span>
              ) : (
                <span>Offset: {params.offset || 0}</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataControls; 