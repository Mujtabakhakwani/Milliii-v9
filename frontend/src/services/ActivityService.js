import { API_URL } from '../config';

class ActivityService {
  constructor(userId) {
    this.userId = userId;
    this.timeEntryId = null;
    this.isMonitoring = false;
    this.currentMinute = null;
    this.currentActivity = {
      mouse_distance_px: 0,
      mouse_clicks: 0,
      keystrokes: 0
    };
    this.lastMousePosition = { x: 0, y: 0 };
    this.lastActiveTime = Date.now();
    this.uploadInterval = null;
    this.onActivityUpdate = null;
    
    // Throttling
    this.lastMouseMoveTime = 0;
    this.mouseMoveThrottle = 100; // 10 Hz
    
    // Bound event handlers
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.handleWindowFocus = this.handleWindowFocus.bind(this);
  }

  startMonitoring(timeEntryId, onActivityUpdate) {
    if (this.isMonitoring) {
      console.log('🔍 Activity monitoring already running');
      return;
    }

    console.log('🔍 Starting activity monitoring for time entry:', timeEntryId);
    this.timeEntryId = timeEntryId;
    this.onActivityUpdate = onActivityUpdate;
    this.isMonitoring = true;
    this.lastActiveTime = Date.now();
    this.currentMinute = this.getCurrentMinuteBucket();
    this.resetCurrentActivity();

    // Add event listeners
    document.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    document.addEventListener('pointerdown', this.handlePointerDown, { passive: true });
    document.addEventListener('keydown', this.handleKeyDown, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);

    // Start upload interval (every 60 seconds)
    this.uploadInterval = setInterval(() => {
      this.uploadCurrentMinute();
    }, 60000);

    console.log('🔍 Activity monitoring started');
  }

  async stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    console.log('🔍 Stopping activity monitoring');
    this.isMonitoring = false;

    // Remove event listeners
    document.removeEventListener('pointermove', this.handlePointerMove);
    document.removeEventListener('pointerdown', this.handlePointerDown);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);

    // Clear upload interval
    if (this.uploadInterval) {
      clearInterval(this.uploadInterval);
      this.uploadInterval = null;
    }

    // Upload final minute data
    await this.uploadCurrentMinute();

    console.log('🔍 Activity monitoring stopped');
  }

  getCurrentMinuteBucket() {
    const now = new Date();
    now.setSeconds(0, 0); // Round down to the start of the minute
    return now.toISOString();
  }

  resetCurrentActivity() {
    this.currentActivity = {
      mouse_distance_px: 0,
      mouse_clicks: 0,
      keystrokes: 0
    };
  }

  handlePointerMove(event) {
    if (!this.isMonitoring || !this.isPageActive()) {
      return;
    }

    // Ignore synthetic events
    if (!event.isTrusted) {
      return;
    }

    // Throttle mouse move events
    const now = Date.now();
    if (now - this.lastMouseMoveTime < this.mouseMoveThrottle) {
      return;
    }
    this.lastMouseMoveTime = now;

    // Calculate distance moved
    const currentX = event.clientX;
    const currentY = event.clientY;
    const distance = Math.sqrt(
      Math.pow(currentX - this.lastMousePosition.x, 2) +
      Math.pow(currentY - this.lastMousePosition.y, 2)
    );

    // Update activity only if significant movement
    if (distance > 5) { // Minimum 5px movement to avoid noise
      this.checkMinuteRollover();
      this.currentActivity.mouse_distance_px += Math.round(distance);
      this.lastMousePosition = { x: currentX, y: currentY };
      this.lastActiveTime = now;
      this.notifyActivityUpdate();
    }
  }

  handlePointerDown(event) {
    if (!this.isMonitoring || !this.isPageActive()) {
      return;
    }

    // Ignore synthetic events
    if (!event.isTrusted) {
      return;
    }

    this.checkMinuteRollover();
    this.currentActivity.mouse_clicks += 1;
    this.lastActiveTime = Date.now();
    this.notifyActivityUpdate();
  }

  handleKeyDown(event) {
    if (!this.isMonitoring || !this.isPageActive()) {
      return;
    }

    // Ignore synthetic events and auto-repeats
    if (!event.isTrusted || event.repeat) {
      return;
    }

    // Ignore modifier-only keys
    if (['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock'].includes(event.key)) {
      return;
    }

    this.checkMinuteRollover();
    this.currentActivity.keystrokes += 1;
    this.lastActiveTime = Date.now();
    this.notifyActivityUpdate();
  }

  handleVisibilityChange() {
    // Activity monitoring automatically pauses/resumes based on page visibility
    console.log('🔍 Page visibility changed:', document.hidden ? 'hidden' : 'visible');
  }

  handleWindowBlur() {
    console.log('🔍 Window lost focus - pausing activity monitoring');
  }

  handleWindowFocus() {
    console.log('🔍 Window gained focus - resuming activity monitoring');
    this.lastActiveTime = Date.now();
  }

  isPageActive() {
    return !document.hidden && document.hasFocus();
  }

  checkMinuteRollover() {
    const currentMinuteBucket = this.getCurrentMinuteBucket();
    
    if (currentMinuteBucket !== this.currentMinute) {
      // Upload the previous minute's data
      this.uploadCurrentMinute();
      
      // Start new minute
      this.currentMinute = currentMinuteBucket;
      this.resetCurrentActivity();
    }
  }

  async uploadCurrentMinute() {
    if (!this.timeEntryId || !this.currentMinute) {
      return;
    }

    // Only upload if there was some activity
    const hasActivity = this.currentActivity.mouse_distance_px > 0 || 
                       this.currentActivity.mouse_clicks > 0 || 
                       this.currentActivity.keystrokes > 0;

    if (!hasActivity) {
      return;
    }

    const activityData = {
      time_entry_id: this.timeEntryId,
      minute_start: this.currentMinute,
      mouse_distance_px: this.currentActivity.mouse_distance_px,
      mouse_clicks: this.currentActivity.mouse_clicks,
      keystrokes: this.currentActivity.keystrokes
    };

    try {
      const response = await fetch(`${API_URL}/api/time-entries/${this.timeEntryId}/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(activityData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('🔍 Activity data uploaded:', result.aggregated ? 'aggregated' : 'new');

    } catch (error) {
      console.error('🔍 Failed to upload activity data:', error);
      
      // Store failed upload for retry later
      await this.storeFailedActivity(activityData);
    }
  }

  async storeFailedActivity(activityData) {
    try {
      // Store in IndexedDB for retry when online
      if ('indexedDB' in window) {
        const dbName = 'timeTracker';
        const dbVersion = 1;
        
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(dbName, dbVersion);
          
          request.onerror = () => reject(request.error);
          
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['failedActivity'], 'readwrite');
            const store = transaction.objectStore('failedActivity');
            
            const failedActivity = {
              id: Date.now(),
              timeEntryId: this.timeEntryId,
              timestamp: new Date().toISOString(),
              data: activityData
            };
            
            store.add(failedActivity);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
          };
          
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('failedActivity')) {
              db.createObjectStore('failedActivity', { keyPath: 'id' });
            }
          };
        });
      }
    } catch (error) {
      console.error('Failed to store failed activity:', error);
    }
  }

  notifyActivityUpdate() {
    if (this.onActivityUpdate) {
      this.onActivityUpdate({
        ...this.currentActivity,
        minute_start: this.currentMinute,
        last_active: new Date(this.lastActiveTime).toISOString()
      });
    }
  }

  // Get current activity stats
  getCurrentActivity() {
    return {
      ...this.currentActivity,
      minute_start: this.currentMinute,
      is_active: this.isPageActive(),
      last_active: new Date(this.lastActiveTime).toISOString()
    };
  }

  // Retry failed uploads
  async retryFailedUploads() {
    if (!('indexedDB' in window)) {
      return;
    }

    try {
      const dbName = 'timeTracker';
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      // Retry failed activity uploads
      const activityTransaction = db.transaction(['failedActivity'], 'readwrite');
      const activityStore = activityTransaction.objectStore('failedActivity');
      const activityCursor = await new Promise((resolve) => {
        const request = activityStore.openCursor();
        request.onsuccess = () => resolve(request.result);
      });

      if (activityCursor) {
        const failedActivity = activityCursor.value;
        
        try {
          await fetch(`${API_URL}/api/time-entries/${failedActivity.timeEntryId}/activity`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(failedActivity.data)
          });
          
          // Delete from IndexedDB on success
          activityCursor.delete();
          console.log('🔍 Retried failed activity upload successfully');
          
        } catch (error) {
          console.error('🔍 Failed to retry activity upload:', error);
        }
      }

      db.close();
      
    } catch (error) {
      console.error('Failed to retry failed uploads:', error);
    }
  }
}

export default ActivityService;