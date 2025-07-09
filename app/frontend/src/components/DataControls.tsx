import { useState, useEffect } from 'react';
import type { HistoryParams } from '../types/api';

interface DataControlsProps {
  params: HistoryParams;
  onParamsChange: (newParams: HistoryParams) => void;
  disabled?: boolean;
}

const DataControls: React.FC<DataControlsProps> = ({ params, onParamsChange, disabled = false }) => {
  const [localParams, setLocalParams] = useState<HistoryParams>(params);
  const [useTermMode, setUseTermMode] = useState<boolean>(params.term !== undefined && params.term > 0);

  useEffect(() => {
    setLocalParams(params);
    setUseTermMode(params.term !== undefined && params.term > 0);
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

    // Clear offset when using term mode
    if (field === 'term' && numValue && numValue > 0) {
      newParams.offset = 0;
    }

    // Clear term when using offset mode
    if (field === 'offset' && numValue !== undefined) {
      newParams.term = 0;
    }

    setLocalParams(newParams);
  };

  const handleModeChange = (termMode: boolean) => {
    setUseTermMode(termMode);
    
    const newParams = { ...localParams };
    if (termMode) {
      // Switch to term mode
      newParams.offset = 0;
      if (!newParams.term || newParams.term <= 0) {
        newParams.term = 5; // Default term value
      }
    } else {
      // Switch to offset mode
      newParams.term = 0;
      if (newParams.offset === undefined) {
        newParams.offset = 0; // Default offset value
      }
    }
    
    setLocalParams(newParams);
    onParamsChange(newParams);
  };

  const handleApply = () => {
    onParamsChange(localParams);
  };

  const handleReset = () => {
    const defaultParams: HistoryParams = {
      limit: 50,
      offset: 0,
      term: 0,
    };
    setLocalParams(defaultParams);
    setUseTermMode(false);
    onParamsChange(defaultParams);
  };

  const isChanged = JSON.stringify(localParams) !== JSON.stringify(params);

  return (
    <div className="data-controls">
      <h3>Data Filters</h3>
      
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

      <div className="control-group mode-selector">
        <label>Data Mode:</label>
        <div className="radio-group">
          <label className="radio-label">
            <input
              type="radio"
              name="dataMode"
              checked={!useTermMode}
              onChange={() => handleModeChange(false)}
              disabled={disabled}
            />
            Pagination (offset)
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="dataMode"
              checked={useTermMode}
              onChange={() => handleModeChange(true)}
              disabled={disabled}
            />
            Interval sampling (term)
          </label>
        </div>
      </div>

      {!useTermMode && (
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

      {useTermMode && (
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

      <div className="current-params">
        <h4>Current Parameters:</h4>
        <div className="params-display">
          <span>Limit: {params.limit || 50}</span>
          {params.term && params.term > 0 ? (
            <span>Term: {params.term}</span>
          ) : (
            <span>Offset: {params.offset || 0}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataControls; 