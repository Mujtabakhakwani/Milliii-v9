import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { Play, Square, CheckCircle, Monitor, AlertTriangle, Eye, Clock, MousePointer, Keyboard } from 'lucide-react';
import useTimeTracker from '../hooks/useTimeTracker';

const ConsentDialog = ({ open, onConsent, onCancel }) => (
  <Dialog open={open} onOpenChange={onCancel}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Monitor className="w-5 h-5" />
          Time Tracking Consent
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            What data do we collect?
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Screen screenshots every 2 minutes while tracking</li>
            <li>• Mouse movement distance and clicks</li>
            <li>• Keyboard activity (keystroke counts only)</li>
            <li>• Time spent on tasks</li>
          </ul>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <h3 className="font-medium text-green-900 dark:text-green-100 mb-2">
            Privacy & Security
          </h3>
          <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
            <li>• No audio is ever recorded</li>
            <li>• Screenshots are stored securely</li>
            <li>• Activity data is aggregated by minute</li>
            <li>• You can revoke consent anytime</li>
          </ul>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          By clicking "I Agree", you consent to screen capture and activity monitoring while time tracking is active.
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConsent} className="bg-blue-600 hover:bg-blue-700">
            I Agree
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

const ScreenshotHelperDialog = ({ open, onClose, error }) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          Fix Screenshots
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {error}
        </div>
        
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <h3 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
            macOS Users
          </h3>
          <div className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
            <p>1. Open <strong>System Settings → Privacy & Security</strong></p>
            <p>2. Click <strong>Screen Recording</strong></p>
            <p>3. Enable permission for your browser</p>
            <p>4. Restart your browser and try again</p>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            Windows Users
          </h3>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <p>1. When prompted, click <strong>"Allow"</strong> to share your screen</p>
            <p>2. Select the entire screen or specific application window</p>
            <p>3. Avoid selecting protected video content (Netflix, etc.)</p>
          </div>
        </div>

        <Button onClick={onClose} className="w-full">
          Got it
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

const TimeTrackerComponent = ({ currentUser, selectedTask, selectedProject }) => {
  const {
    activeTimeEntry,
    isTracking,
    elapsedTime,
    elapsedSeconds,
    lastScreenshotTime,
    currentActivity,
    consentGiven,
    error,
    sourceLabel,
    screenshotPreviewUrl,
    startTracking,
    stopTracking,
    completeTask,
    giveConsent,
    revokeConsent
  } = useTimeTracker(currentUser);

  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [showHelperDialog, setShowHelperDialog] = useState(false);
  const [screenshots, setScreenshots] = useState([]);

  // Listen for screenshot errors
  useEffect(() => {
    const handleScreenshotError = (event) => {
      setShowHelperDialog(true);
    };

    window.addEventListener('screenshot-error', handleScreenshotError);
    return () => window.removeEventListener('screenshot-error', handleScreenshotError);
  }, []);

  const fetchScreenshots = useCallback(async () => {
    if (!activeTimeEntry) return;

    try {
      const response = await fetch(`/api/time-entries/${activeTimeEntry.id}/screenshots`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setScreenshots(data.screenshots || []);
      }
    } catch (error) {
      console.error('Failed to fetch screenshots:', error);
    }
  }, [activeTimeEntry]);

  // Fetch screenshots when tracking starts
  useEffect(() => {
    if (activeTimeEntry) {
      fetchScreenshots();
      // Refresh screenshots periodically
      const interval = setInterval(fetchScreenshots, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [activeTimeEntry, fetchScreenshots]);

  const handleStartTracking = async () => {
    if (!consentGiven) {
      setShowConsentDialog(true);
      return;
    }

    if (!selectedTask || !selectedProject) {
      toast.error('Please select a task and project first');
      return;
    }

    try {
      await startTracking(selectedTask.id, selectedProject.id);
    } catch (error) {
      console.error('Failed to start tracking:', error);
      if (error.message.includes('permission') || error.message.includes('NotAllowedError')) {
        setShowHelperDialog(true);
      }
    }
  };

  const handleConsentGiven = async () => {
    giveConsent();
    setShowConsentDialog(false);
    
    if (selectedTask && selectedProject) {
      try {
        await startTracking(selectedTask.id, selectedProject.id);
      } catch (error) {
        console.error('Failed to start tracking after consent:', error);
        if (error.message.includes('permission') || error.message.includes('NotAllowedError')) {
          setShowHelperDialog(true);
        }
      }
    }
  };

  const formatLastScreenshot = () => {
    if (!lastScreenshotTime) return 'No screenshots yet';
    const seconds = Math.floor((Date.now() - lastScreenshotTime.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  if (!consentGiven) {
    return (
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center space-y-4">
          <Monitor className="w-12 h-12 text-gray-400 mx-auto" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Enhanced Time Tracking
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Time tracking with screen capture and activity monitoring requires your consent.
          </p>
          <Button onClick={() => setShowConsentDialog(true)} className="bg-blue-600 hover:bg-blue-700">
            Enable Time Tracking
          </Button>
        </div>
        
        <ConsentDialog
          open={showConsentDialog}
          onConsent={handleConsentGiven}
          onCancel={() => setShowConsentDialog(false)}
        />
      </div>
    );
  }

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
      {/* Main Controls */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Time Tracker
          </h3>
          {activeTimeEntry && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {activeTimeEntry.task?.title || 'Unknown Task'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!isTracking ? (
            <Button
              onClick={handleStartTracking}
              disabled={!selectedTask || !selectedProject}
              className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Tracking
            </Button>
          ) : (
            <>
              <Button
                onClick={() => stopTracking()}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                Stop
              </Button>
              <Button
                onClick={completeTask}
                className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Complete Task
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 dark:text-red-200 font-medium">Time Tracking Error</p>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Status Banner */}
      {isTracking && (
        <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-sm opacity-90">
                <Clock className="w-4 h-4" />
                Elapsed
              </div>
              <div className="text-xl font-mono font-bold">{elapsedTime}</div>
            </div>
            
            <div>
              <div className="flex items-center justify-center gap-1 text-sm opacity-90">
                <Monitor className="w-4 h-4" />
                Source
              </div>
              <div className="text-sm font-medium">{sourceLabel || 'Screen'}</div>
            </div>
            
            <div>
              <div className="flex items-center justify-center gap-1 text-sm opacity-90">
                <MousePointer className="w-4 h-4" />
                Mouse
              </div>
              <div className="text-sm">
                {currentActivity.mouse_distance_px}px · {currentActivity.mouse_clicks} clicks
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-center gap-1 text-sm opacity-90">
                <Keyboard className="w-4 h-4" />
                Keys
              </div>
              <div className="text-sm">{currentActivity.keystrokes} strokes</div>
            </div>
          </div>
          
          <div className="mt-3 text-center text-sm opacity-90">
            Last screenshot: {formatLastScreenshot()}
          </div>
        </div>
      )}

      {/* Screen Capture Preview */}
      {screenshotPreviewUrl && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Screen Capture Preview
          </h4>
          <div className="flex items-center gap-4">
            <img
              src={screenshotPreviewUrl}
              alt="Screen capture preview"
              className="w-32 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
            />
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>Capturing: {sourceLabel}</p>
              <p>Screenshots every 2 minutes</p>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Gallery */}
      {screenshots.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Screenshots ({screenshots.length})
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchScreenshots}
              className="text-gray-500 hover:text-gray-700"
            >
              Refresh
            </Button>
          </div>
          
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
            {screenshots.slice(-12).map((screenshot) => (
              <div key={screenshot.id} className="relative group">
                <img
                  src={screenshot.screenshot_url}
                  alt={`Screenshot ${new Date(screenshot.captured_at).toLocaleTimeString()}`}
                  className="w-full h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:ring-2 hover:ring-blue-500"
                  onClick={() => {
                    // Open screenshot in new tab
                    window.open(screenshot.screenshot_url, '_blank');
                  }}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg flex items-center justify-center transition-all">
                  <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent rounded-b-lg">
                  <div className="text-xs text-white px-1 py-0.5">
                    {new Date(screenshot.captured_at).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Enhanced time tracking enabled
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={revokeConsent}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Disable
          </Button>
        </div>
      </div>

      {/* Helper Dialogs */}
      <ScreenshotHelperDialog
        open={showHelperDialog}
        onClose={() => setShowHelperDialog(false)}
        error={error}
      />
      
      <ConsentDialog
        open={showConsentDialog}
        onConsent={handleConsentGiven}
        onCancel={() => setShowConsentDialog(false)}
      />
    </div>
  );
};

export default TimeTrackerComponent;