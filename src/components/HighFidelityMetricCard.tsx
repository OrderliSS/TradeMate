import React, { ReactNode } from 'react';
import './HighFidelityMetricCard.css';

interface HighFidelityMetricCardProps {
  title: string;
  value: string | number;
  subValue?: ReactNode;
  icon?: ReactNode;
  accentColor?: 'blue' | 'green' | 'purple';
  isLocked?: boolean;
  isLoading?: boolean;
}

export const HighFidelityMetricCard = ({
  title,
  value,
  subValue,
  icon,
  accentColor = 'blue',
  isLocked = false,
  isLoading = false,
}: HighFidelityMetricCardProps) => {
  if (isLoading) {
    return (
      <div className="metric-card skeleton-pulse">
        <div className="skeleton-title" />
        <div className="skeleton-value" />
      </div>
    );
  }

  return (
    <div className={`metric-card premium-card accent-${accentColor} ${isLocked ? 'locked' : ''}`}>
      <div className="metric-header">
        <span className="metric-title">{title}</span>
        {icon && <div className="metric-icon">{icon}</div>}
      </div>
      <div className="metric-body">
        <div className="metric-value">{value}</div>
        {subValue && <div className="metric-subvalue">{subValue}</div>}
      </div>
      {isLocked && (
        <div className="lock-overlay">
          <div className="lock-tag">Locked</div>
        </div>
      )}
    </div>
  );
};
