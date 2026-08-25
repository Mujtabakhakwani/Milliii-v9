import { useState, useEffect, useCallback, useRef } from 'react';

const useInactivityTimer = ({
  activeTimeEntry,
  onShowWarning,
  onAutoStop,
  warningThreshold = 4 * 60 * 1000, // 4 minutes in milliseconds
  autoStopThreshold = 5 * 60 * 1000, // 5 minutes in milliseconds
}) => {
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [warningShown, setWarningShown] = useState(false);
  const [isInactive, setIsInactive] = useState(false);
  const warningTimerRef = useRef(null);
  const autoStopTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Activity event handlers
  const updateActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);
    lastActivityRef.current = now;
    setWarningShown(false);
    setIsInactive(false);

    // Clear existing timers
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }

    // Only set new timers if there's an active time entry
    if (activeTimeEntry) {
      // Set warning timer (4 minutes)
      warningTimerRef.current = setTimeout(() => {
        console.log('🚨 Inactivity warning: 4 minutes of inactivity detected');
        setWarningShown(true);
        if (onShowWarning) {
          onShowWarning();
        }
      }, warningThreshold);

      // Set auto-stop timer (5 minutes)
      autoStopTimerRef.current = setTimeout(() => {
        console.log('⏹️ Auto-stopping timer due to 5 minutes of inactivity');
        setIsInactive(true);
        if (onAutoStop) {
          onAutoStop();
        }
      }, autoStopThreshold);
    }
  }, [activeTimeEntry, onShowWarning, onAutoStop, warningThreshold, autoStopThreshold]);

  // Activity events to monitor
  const activityEvents = [
    'mousedown',
    'mousemove', 
    'keypress',
    'keydown',
    'scroll',
    'touchstart',
    'click'
  ];

  // Set up activity listeners
  useEffect(() => {
    // Only monitor if there's an active time entry
    if (!activeTimeEntry) {
      // Clear timers if no active time entry
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
        warningTimerRef.current = null;
      }
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      setWarningShown(false);
      setIsInactive(false);
      return;
    }

    // Throttle activity updates to avoid excessive calls
    let throttleTimeout = null;
    const throttledUpdateActivity = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        updateActivity();
        throttleTimeout = null;
      }, 1000); // Throttle to once per second
    };

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, throttledUpdateActivity, { passive: true });
    });

    // Initialize activity tracking
    updateActivity();

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, throttledUpdateActivity);
      });
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
      }
    };
  }, [activeTimeEntry, updateActivity]);

  // Manual activity trigger for when user interacts with warnings
  const triggerActivity = useCallback(() => {
    updateActivity();
  }, [updateActivity]);

  // Get time until warning/auto-stop
  const getTimeUntilWarning = useCallback(() => {
    const timeSinceActivity = Date.now() - lastActivityRef.current;
    const timeUntilWarning = Math.max(0, warningThreshold - timeSinceActivity);
    return Math.ceil(timeUntilWarning / 1000); // Return in seconds
  }, [warningThreshold]);

  const getTimeUntilAutoStop = useCallback(() => {
    const timeSinceActivity = Date.now() - lastActivityRef.current;
    const timeUntilAutoStop = Math.max(0, autoStopThreshold - timeSinceActivity);
    return Math.ceil(timeUntilAutoStop / 1000); // Return in seconds
  }, [autoStopThreshold]);

  return {
    lastActivity,
    warningShown,
    isInactive,
    triggerActivity,
    getTimeUntilWarning,
    getTimeUntilAutoStop,
    isTrackingInactivity: !!activeTimeEntry
  };
};

export default useInactivityTimer;