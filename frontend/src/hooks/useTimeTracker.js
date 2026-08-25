import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import ScreenshotService from '../services/ScreenshotService';
import ActivityService from '../services/ActivityService';
import { API_URL } from '../config';

const useTimeTracker = (currentUser) => {
  const [activeTimeEntry, setActiveTimeEntry] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [lastScreenshotTime, setLastScreenshotTime] = useState(null);
  const [currentActivity, setCurrentActivity] = useState({
    mouse_distance_px: 0,
    mouse_clicks: 0,
    keystrokes: 0
  });
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState('');

  // Services refs
  const screenshotServiceRef = useRef(null);
  const activityServiceRef = useRef(null);
  const timerRef = useRef(null);

  // Initialize services
  useEffect(() => {
    if (currentUser) {
      screenshotServiceRef.current = new ScreenshotService(currentUser.id);
      activityServiceRef.current = new ActivityService(currentUser.id);
    }
  }, [currentUser]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup without calling stopTracking to avoid infinite loops
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (screenshotServiceRef.current) {
        screenshotServiceRef.current.stopCapture();
      }
      if (activityServiceRef.current) {
        activityServiceRef.current.stopMonitoring();
      }
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Empty dependency array for cleanup only

  // Timer for elapsed time
  useEffect(() => {
    if (isTracking && activeTimeEntry) {
      timerRef.current = setInterval(() => {
        const startTime = new Date(activeTimeEntry.clock_in_time);
        const now = new Date();
        setElapsedTime(Math.floor((now - startTime) / 1000));
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [isTracking, activeTimeEntry]);

  // Activity monitoring callback
  const onActivityUpdate = useCallback((activityData) => {
    setCurrentActivity(activityData);
  }, []);

  const requestScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: 5
        },
        audio: false,
        preferCurrentTab: false
      });

      // Try to get the source label
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      const displaySurface = settings.displaySurface || 'unknown';
      
      // Create a preview element to show what's being captured
      const videoElement = document.createElement('video');
      videoElement.srcObject = stream;
      videoElement.muted = true;
      videoElement.autoplay = true;
      
      // Wait for video to be ready and capture preview
      videoElement.addEventListener('loadedmetadata', () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = Math.min(videoElement.videoWidth, 200);
        canvas.height = Math.min(videoElement.videoHeight, 150);
        
        setTimeout(() => {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          setScreenshotPreviewUrl(canvas.toDataURL('image/jpeg', 0.8));
        }, 500);
      });

      setScreenStream(stream);
      setSourceLabel(`${displaySurface === 'monitor' ? 'Monitor' : displaySurface === 'window' ? 'Window' : 'Browser Tab'}`);
      
      return stream;
    } catch (error) {
      console.error('Error requesting screen capture:', error);
      
      if (error.name === 'NotAllowedError') {
        setError('Screen capture permission denied. Please allow screen sharing to enable time tracking.');
      } else if (error.name === 'NotSupportedError') {
        setError('Screen capture not supported in this browser.');
      } else {
        setError('Failed to start screen capture. Please try again.');
      }
      
      throw error;
    }
  };

  const startTracking = useCallback(async (taskId, projectId) => {
    try {
      setError(null);
      
      if (!consentGiven) {
        throw new Error('Consent required before starting time tracking');
      }

      // Request screen capture first
      const stream = await requestScreenCapture();
      
      // Create time entry
      const response = await fetch(`${API_URL}/api/time-entries/clock-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          task_id: taskId,
          project_id: projectId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start time tracking');
      }

      const data = await response.json();
      const timeEntry = data.time_entry;
      
      setActiveTimeEntry(timeEntry);
      setIsTracking(true);
      setElapsedTime(0);
      
      // Initialize screenshot service
      if (screenshotServiceRef.current) {
        await screenshotServiceRef.current.initialize(stream, timeEntry.id, taskId, projectId);
        await screenshotServiceRef.current.startCapture();
        setLastScreenshotTime(new Date());
      }
      
      // Initialize activity service  
      if (activityServiceRef.current) {
        activityServiceRef.current.startMonitoring(timeEntry.id, onActivityUpdate);
      }

      toast.success('Time tracking started', {
        description: `Tracking ${timeEntry.task?.title || 'task'} with screen capture enabled`
      });

    } catch (error) {
      console.error('Error starting time tracking:', error);
      setError(error.message);
      
      // Clean up stream if created but tracking failed
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }
      
      throw error;
    }
  }, [consentGiven, screenStream, onActivityUpdate]);

  const stopTracking = useCallback(async (note = null) => {
    try {
      if (!activeTimeEntry) {
        return;
      }

      // Stop activity monitoring first
      if (activityServiceRef.current) {
        await activityServiceRef.current.stopMonitoring();
      }

      // Stop screenshot capture
      if (screenshotServiceRef.current) {
        await screenshotServiceRef.current.stopCapture();
      }

      // Stop screen stream
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }

      // Clock out
      const response = await fetch(`${API_URL}/api/time-entries/clock-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          time_entry_id: activeTimeEntry.id,
          note: note
        })
      });

      if (!response.ok) {
        throw new Error('Failed to stop time tracking');
      }

      const data = await response.json();
      
      setActiveTimeEntry(null);
      setIsTracking(false);
      setElapsedTime(0);
      setLastScreenshotTime(null);
      setCurrentActivity({
        mouse_distance_px: 0,
        mouse_clicks: 0,
        keystrokes: 0
      });
      setSourceLabel('');
      setScreenshotPreviewUrl('');

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      toast.success('Time tracking stopped', {
        description: data.auto_stopped 
          ? 'Timer was stopped automatically due to inactivity'
          : `Total time: ${Math.floor(data.duration_seconds / 3600)}h ${Math.floor((data.duration_seconds % 3600) / 60)}m`
      });

    } catch (error) {
      console.error('Error stopping time tracking:', error);
      toast.error('Failed to stop time tracking');
      throw error;
    }
  }, [activeTimeEntry, screenStream]);

  const completeTask = async () => {
    if (!activeTimeEntry) {
      return;
    }

    try {
      // First stop tracking
      await stopTracking('Task completed');
      
      // Then mark task as completed
      const response = await fetch(`${API_URL}/api/tasks/${activeTimeEntry.task_id}`, {
        method: 'PUT', 
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          status: 'Completed'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to complete task');
      }

      toast.success('Task completed successfully');
      
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Failed to complete task');
      throw error;
    }
  };

  const giveConsent = () => {
    setConsentGiven(true);
    localStorage.setItem('timeTrackerConsent', 'true');
  };

  const revokeConsent = () => {
    setConsentGiven(false);
    localStorage.removeItem('timeTrackerConsent');
    if (isTracking) {
      stopTracking('Consent revoked');
    }
  };

  // Check for existing consent on load
  useEffect(() => {
    const savedConsent = localStorage.getItem('timeTrackerConsent');
    if (savedConsent === 'true') {
      setConsentGiven(true);
    }
  }, []);

  // Format elapsed time
  const formatElapsedTime = () => {
    const hours = Math.floor(elapsedTime / 3600);
    const minutes = Math.floor((elapsedTime % 3600) / 60);
    const seconds = elapsedTime % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    // State
    activeTimeEntry,
    isTracking,
    elapsedTime: formatElapsedTime(),
    elapsedSeconds: elapsedTime,
    lastScreenshotTime,
    currentActivity,
    consentGiven,
    error,
    sourceLabel,
    screenshotPreviewUrl,
    
    // Actions  
    startTracking,
    stopTracking,
    completeTask,
    giveConsent,
    revokeConsent,
    
    // Utils
    formatElapsedTime
  };
};

export default useTimeTracker;