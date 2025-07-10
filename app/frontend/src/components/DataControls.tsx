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
      limit: 50, // Always 50 for time-based filtering
      time_period: period as '1d' | '1w' | '1m' | '1y',
    };
    
    setLocalParams(newParams);
    onParamsChange(newParams); // Apply immediately
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
    </div>
  );
};

export default DataControls; 