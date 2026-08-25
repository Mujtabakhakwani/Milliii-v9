import { API_URL } from '../config';

class ScreenshotService {
  constructor(userId) {
    this.userId = userId;
    this.stream = null;
    this.videoElement = null;
    this.imageCapture = null;
    this.intervalId = null;
    this.timeEntryId = null;
    this.taskId = null;
    this.projectId = null;
    this.isCapturing = false;
    this.failureCount = 0;
    this.maxFailures = 3;
    this.intervalMs = 120000; // 2 minutes
  }

  async initialize(stream, timeEntryId, taskId, projectId) {
    this.stream = stream;
    this.timeEntryId = timeEntryId;
    this.taskId = taskId;
    this.projectId = projectId;
    this.failureCount = 0;

    // Create video element
    this.videoElement = document.createElement('video');
    this.videoElement.srcObject = stream;
    this.videoElement.muted = true;
    this.videoElement.autoplay = true;
    
    // Wait for video to be ready
    return new Promise((resolve, reject) => {
      this.videoElement.onloadedmetadata = () => {
        console.log('📹 Video metadata loaded, resolution:', this.videoElement.videoWidth, 'x', this.videoElement.videoHeight);
        
        // Try to use ImageCapture if supported
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && window.ImageCapture) {
          try {
            this.imageCapture = new ImageCapture(videoTrack);
            console.log('📸 ImageCapture initialized successfully');
          } catch (error) {
            console.warn('📸 ImageCapture failed to initialize:', error);
            this.imageCapture = null;
          }
        }
        
        resolve();
      };
      
      this.videoElement.onerror = (error) => {
        console.error('📹 Video element error:', error);
        reject(error);
      };
    });
  }

  async startCapture() {
    if (this.isCapturing) {
      console.log('📸 Screenshot capture already running');
      return;
    }

    console.log('📸 Starting screenshot capture every', this.intervalMs / 1000, 'seconds');
    this.isCapturing = true;

    // Take immediate screenshot
    await this.captureAndUpload();

    // Schedule recurring captures
    this.intervalId = setInterval(() => {
      this.captureAndUpload();
    }, this.intervalMs);
  }

  async stopCapture() {
    console.log('📸 Stopping screenshot capture');
    this.isCapturing = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Clean up video element
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    this.imageCapture = null;
  }

  async captureAndUpload() {
    if (!this.isCapturing || !this.timeEntryId) {
      return;
    }

    try {
      console.log('📸 Capturing screenshot...');
      const blob = await this.captureScreenshot();
      
      if (!blob) {
        throw new Error('Failed to capture screenshot (null blob)');
      }

      await this.uploadScreenshot(blob);
      
      // Reset failure count on success
      this.failureCount = 0;
      
    } catch (error) {
      console.error('📸 Screenshot capture failed:', error);
      this.failureCount++;
      
      if (this.failureCount >= this.maxFailures) {
        console.error('📸 Max screenshot failures reached, stopping capture');
        this.stopCapture();
        
        // Notify user about screenshot issues
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('screenshot-error', {
            detail: { 
              message: 'Screenshot capture failed repeatedly. Please check screen recording permissions.',
              error: error.message
            }
          }));
        }
      }
    }
  }

  async captureScreenshot() {
    if (!this.videoElement || !this.stream) {
      throw new Error('Video element not initialized');
    }

    // Check if video is playing
    if (this.videoElement.readyState < 3) { // HAVE_FUTURE_DATA
      throw new Error('Video not ready for capture');
    }

    let blob = null;

    // Try ImageCapture first (preferred)
    if (this.imageCapture) {
      try {
        const imageBitmap = await this.imageCapture.grabFrame();
        blob = await this.bitmapToBlob(imageBitmap);
        console.log('📸 Screenshot captured using ImageCapture');
      } catch (error) {
        console.warn('📸 ImageCapture failed, falling back to canvas:', error);
        this.imageCapture = null; // Disable for future captures
      }
    }

    // Fallback to canvas method
    if (!blob) {
      blob = await this.canvasCapture();
      console.log('📸 Screenshot captured using Canvas');
    }

    // Validate the blob
    if (!blob || blob.size === 0) {
      throw new Error('Generated screenshot is empty');
    }

    // Basic validation - check if it's not a completely black image
    const isBlack = await this.isBlackImage(blob);
    if (isBlack) {
      throw new Error('Screenshot appears to be black (protected content or permission issue)');
    }

    return blob;
  }

  async bitmapToBlob(imageBitmap) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    
    ctx.drawImage(imageBitmap, 0, 0);
    
    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.85);
    });
  }

  async canvasCapture() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;
    
    // Draw the video frame to canvas
    ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
    
    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.85);
    });
  }

  async isBlackImage(blob) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Sample a few pixels to check if image is mostly black
        const imageData = ctx.getImageData(0, 0, Math.min(100, canvas.width), Math.min(100, canvas.height));
        const data = imageData.data;
        
        let blackPixels = 0;
        const totalPixels = data.length / 4;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1]; 
          const b = data[i + 2];
          
          if (r < 10 && g < 10 && b < 10) {
            blackPixels++;
          }
        }
        
        const blackRatio = blackPixels / totalPixels;
        resolve(blackRatio > 0.9); // Consider black if >90% of sampled pixels are black
      };
      
      img.onerror = () => resolve(false);
      img.src = URL.createObjectURL(blob);
    });
  }

  async uploadScreenshot(blob) {
    // Calculate hash
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Get video dimensions
    const width = this.videoElement.videoWidth;
    const height = this.videoElement.videoHeight;
    
    // Get display surface from stream
    const videoTrack = this.stream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    const displaySurface = settings.displaySurface || 'unknown';

    // Prepare form data with both file and metadata as form fields
    const formData = new FormData();
    formData.append('file', blob, `screenshot-${Date.now()}.jpg`);
    formData.append('captured_at', new Date().toISOString());
    formData.append('width', width.toString());
    formData.append('height', height.toString());
    formData.append('display_surface', displaySurface);
    formData.append('file_hash', fileHash);

    // Upload with retry logic
    await this.uploadWithRetry(formData, fileHash);
  }

  async uploadWithRetry(formData, fileHash, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${API_URL}/api/time-entries/${this.timeEntryId}/screenshots`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.duplicate) {
          console.log('📸 Screenshot already exists (duplicate hash)');
        } else {
          console.log('📸 Screenshot uploaded successfully:', result.screenshot_id);
        }
        
        return result;
        
      } catch (error) {
        console.error(`📸 Upload attempt ${attempt}/${retries} failed:`, error);
        
        if (attempt === retries) {
          // Store failed upload for retry later
          await this.storeFailedUpload(formData, fileHash);
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  async storeFailedUpload(formData, fileHash) {
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
            const transaction = db.transaction(['failedUploads'], 'readwrite');
            const store = transaction.objectStore('failedUploads');
            
            const failedUpload = {
              id: Date.now(),
              timeEntryId: this.timeEntryId,
              fileHash: fileHash,
              timestamp: new Date().toISOString(),
              formData: formData // Note: FormData may not serialize well
            };
            
            store.add(failedUpload);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
          };
          
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('failedUploads')) {
              db.createObjectStore('failedUploads', { keyPath: 'id' });
            }
          };
        });
      }
    } catch (error) {
      console.error('Failed to store failed upload:', error);
    }
  }
}

export default ScreenshotService;