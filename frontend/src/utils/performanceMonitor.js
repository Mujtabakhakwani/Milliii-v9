/**
 * Performance Monitoring Utility
 * Tracks and reports performance metrics
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.apiCallTimes = [];
    this.renderTimes = [];
    this.enabled = process.env.NODE_ENV === 'production';
  }

  /**
   * Mark the start of a performance measurement
   */
  mark(name) {
    if (!this.enabled || !performance.mark) return;
    performance.mark(`${name}-start`);
  }

  /**
   * Measure time since mark and record it
   */
  measure(name, category = 'general') {
    if (!this.enabled || !performance.measure) return;
    
    try {
      performance.measure(name, `${name}-start`);
      const measure = performance.getEntriesByName(name)[0];
      
      if (!this.metrics[category]) {
        this.metrics[category] = [];
      }
      
      this.metrics[category].push({
        name,
        duration: measure.duration,
        timestamp: Date.now()
      });
      
      // Keep only last 100 metrics per category
      if (this.metrics[category].length > 100) {
        this.metrics[category].shift();
      }
      
      // Clean up
      performance.clearMarks(`${name}-start`);
      performance.clearMeasures(name);
      
      return measure.duration;
    } catch (error) {
      console.warn('Performance measure failed:', error);
    }
  }

  /**
   * Track API call performance
   */
  trackAPICall(endpoint, duration, success = true) {
    this.apiCallTimes.push({
      endpoint,
      duration,
      success,
      timestamp: Date.now()
    });
    
    // Keep only last 50 API calls
    if (this.apiCallTimes.length > 50) {
      this.apiCallTimes.shift();
    }
  }

  /**
   * Track component render time
   */
  trackRender(componentName, duration) {
    this.renderTimes.push({
      component: componentName,
      duration,
      timestamp: Date.now()
    });
    
    if (this.renderTimes.length > 50) {
      this.renderTimes.shift();
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const apiStats = this.calculateStats(this.apiCallTimes);
    const renderStats = this.calculateStats(this.renderTimes);
    
    return {
      api: {
        count: this.apiCallTimes.length,
        avgDuration: apiStats.avg,
        maxDuration: apiStats.max,
        minDuration: apiStats.min,
        successRate: this.calculateSuccessRate()
      },
      renders: {
        count: this.renderTimes.length,
        avgDuration: renderStats.avg,
        maxDuration: renderStats.max,
        minDuration: renderStats.min,
        slowest: this.getSlowestRenders(5)
      },
      memory: this.getMemoryInfo(),
      navigation: this.getNavigationTiming()
    };
  }

  /**
   * Calculate basic statistics
   */
  calculateStats(data) {
    if (data.length === 0) {
      return { avg: 0, max: 0, min: 0 };
    }
    
    const durations = data.map(d => d.duration);
    return {
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      max: Math.max(...durations),
      min: Math.min(...durations)
    };
  }

  /**
   * Calculate API success rate
   */
  calculateSuccessRate() {
    if (this.apiCallTimes.length === 0) return 100;
    
    const successful = this.apiCallTimes.filter(call => call.success).length;
    return (successful / this.apiCallTimes.length) * 100;
  }

  /**
   * Get slowest renders
   */
  getSlowestRenders(count = 5) {
    return this.renderTimes
      .sort((a, b) => b.duration - a.duration)
      .slice(0, count)
      .map(r => ({
        component: r.component,
        duration: Math.round(r.duration)
      }));
  }

  /**
   * Get memory information
   */
  getMemoryInfo() {
    if (performance.memory) {
      return {
        usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
        totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
      };
    }
    return null;
  }

  /**
   * Get navigation timing
   */
  getNavigationTiming() {
    if (!performance.timing) return null;
    
    const timing = performance.timing;
    return {
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      loadComplete: timing.loadEventEnd - timing.navigationStart,
      domInteractive: timing.domInteractive - timing.navigationStart,
      firstPaint: this.getFirstPaint()
    };
  }

  /**
   * Get first paint time
   */
  getFirstPaint() {
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return firstPaint ? Math.round(firstPaint.startTime) : null;
  }

  /**
   * Log performance report
   */
  logReport() {
    console.group('📊 Performance Report');
    const stats = this.getStats();
    
    console.log('API Calls:', stats.api);
    console.log('Renders:', stats.renders);
    console.log('Memory:', stats.memory);
    console.log('Navigation:', stats.navigation);
    
    console.groupEnd();
  }

  /**
   * Send metrics to analytics (placeholder)
   */
  sendToAnalytics() {
    if (!this.enabled) return;
    
    const stats = this.getStats();
    
    // TODO: Send to your analytics service
    // Example: analytics.track('performance', stats);
    
    console.log('Performance metrics ready for analytics:', stats);
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = {};
    this.apiCallTimes = [];
    this.renderTimes = [];
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

// React Hook for tracking component renders
export function usePerformanceTracking(componentName) {
  const startTime = performance.now();
  
  return () => {
    const duration = performance.now() - startTime;
    performanceMonitor.trackRender(componentName, duration);
  };
}

// HOC for tracking component performance
export function withPerformanceTracking(Component, componentName) {
  return function TrackedComponent(props) {
    const trackRender = usePerformanceTracking(componentName || Component.name);
    
    React.useEffect(() => {
      trackRender();
    });
    
    return <Component {...props} />;
  };
}

export default performanceMonitor;
