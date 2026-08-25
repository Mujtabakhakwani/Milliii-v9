import React from 'react';
import { Eye, Clock, AlertTriangle } from 'lucide-react';

const InactivityIndicator = ({ 
  isTrackingInactivity, 
  warningShown, 
  isInactive, 
  activeTimeEntry 
}) => {
  if (!isTrackingInactivity || !activeTimeEntry) {
    return null;
  }

  const getIndicatorStyle = () => {
    if (isInactive) {
      return 'bg-red-500/20 border-red-500/40 text-red-700 dark:text-red-300';
    } else if (warningShown) {
      return 'bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300';
    } else {
      return 'bg-green-500/20 border-green-500/40 text-green-700 dark:text-green-300';
    }
  };

  const getIcon = () => {
    if (isInactive) {
      return <AlertTriangle className="w-3 h-3" />;
    } else if (warningShown) {
      return <AlertTriangle className="w-3 h-3" />;
    } else {
      return <Eye className="w-3 h-3" />;
    }
  };

  const getTooltip = () => {
    if (isInactive) {
      return 'Timer stopped due to inactivity';
    } else if (warningShown) {
      return 'Inactivity detected - warning shown';
    } else {
      return 'Monitoring activity - timer will auto-stop after 5 minutes of inactivity';
    }
  };

  return (
    <div
      className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-300 ${getIndicatorStyle()}`}
      title={getTooltip()}
    >
      {getIcon()}
    </div>
  );
};

export default InactivityIndicator;