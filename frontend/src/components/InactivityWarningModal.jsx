import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';

const InactivityWarningModal = ({ 
  show, 
  onContinue, 
  onStopTimer, 
  onClose, 
  timeUntilAutoStop = 60,
  activeTimeEntry 
}) => {
  const [countdown, setCountdown] = useState(timeUntilAutoStop);

  useEffect(() => {
    if (!show) return;

    setCountdown(timeUntilAutoStop);
    
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Auto-stop when countdown reaches 0
          if (onStopTimer) onStopTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [show, timeUntilAutoStop, onStopTimer]);

  if (!show) return null;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const getElapsedTime = () => {
    if (!activeTimeEntry?.clock_in_time) return '00:00:00';
    
    const clockInTime = new Date(activeTimeEntry.clock_in_time);
    const now = new Date();
    const elapsed = Math.floor((now - clockInTime) / 1000);
    
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const secs = elapsed % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        {/* Modal */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 overflow-hidden">
          {/* Header with warning styling */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Inactivity Detected</h2>
                <p className="text-amber-100 text-sm">Timer will auto-stop soon</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center space-x-2 text-gray-600 dark:text-gray-400">
                <Clock className="w-5 h-5" />
                <span className="text-sm">Current session time</span>
              </div>
              <div className="text-3xl font-mono font-bold text-gray-900 dark:text-white">
                {getElapsedTime()}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {activeTimeEntry?.task?.title ? `Working on: ${activeTimeEntry.task.title}` : 'Active time tracking'}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Auto-stopping in
                </span>
              </div>
              <div className="text-2xl font-mono font-bold text-red-600 dark:text-red-400">
                {formatTime(countdown)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                We detected no activity for 4+ minutes
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={onContinue}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
              >
                <CheckCircle className="w-5 h-5" />
                <span>I'm Still Working</span>
              </button>

              <button
                onClick={onStopTimer}
                className="w-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <XCircle className="w-5 h-5" />
                <span>Stop Timer</span>
              </button>
            </div>

            <div className="text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                This helps ensure accurate time tracking by detecting when you step away from work.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InactivityWarningModal;