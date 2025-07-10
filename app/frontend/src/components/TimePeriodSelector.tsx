import React from 'react';
import type { TimePeriodOption } from '../types/api';

interface TimePeriodSelectorProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  disabled?: boolean;
}

const TIME_PERIOD_OPTIONS: TimePeriodOption[] = [
  {
    value: '1d',
    label: '1 Day',
    description: '24 hours ago → now (50 points, most recent guaranteed)'
  },
  {
    value: '1w',
    label: '1 Week',
    description: '7 days ago → now (50 points, most recent guaranteed)'
  },
  {
    value: '1m',
    label: '1 Month',
    description: '30 days ago → now (50 points, most recent guaranteed)'
  },
  {
    value: '1y',
    label: '1 Year',
    description: '365 days ago → now (50 points, most recent guaranteed)'
  }
];

const TimePeriodSelector: React.FC<TimePeriodSelectorProps> = ({
  selectedPeriod,
  onPeriodChange,
  disabled = false
}) => {
  return (
    <div className="time-period-selector">
      <label className="time-period-label">
        Time Period:
        <span className="control-description">Complete time range with most recent data always included</span>
      </label>
      
      <div className="time-period-options">
        {TIME_PERIOD_OPTIONS.map((option) => (
          <label key={option.value} className="time-period-option">
            <input
              type="radio"
              name="timePeriod"
              value={option.value}
              checked={selectedPeriod === option.value}
              onChange={(e) => onPeriodChange(e.target.value)}
              disabled={disabled}
            />
            <div className="option-content">
              <span className="option-label">{option.label}</span>
              <span className="option-description">{option.description}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};

export default TimePeriodSelector; 