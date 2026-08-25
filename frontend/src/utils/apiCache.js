/**
 * Frontend API caching utility
 * Caches API responses to reduce redundant requests
 */

class APICache {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  }

  /**
   * Generate cache key from URL and params
   */
  generateKey(url, params = {}) {
    const paramString = JSON.stringify(params);
    return `${url}:${paramString}`;
  }

  /**
   * Get item from cache if not expired
   */
  get(url, params = {}) {
    const key = this.generateKey(url, params);
    const timestamp = this.timestamps.get(key);
    
    if (!timestamp) return null;
    
    // Check if expired
    const age = Date.now() - timestamp;
    if (age > this.defaultTTL) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return null;
    }
    
    return this.cache.get(key);
  }

  /**
   * Set item in cache
   */
  set(url, params = {}, data, ttl = this.defaultTTL) {
    const key = this.generateKey(url, params);
    this.cache.set(key, data);
    this.timestamps.set(key, Date.now());
  }

  /**
   * Clear specific cache entry
   */
  invalidate(url, params = {}) {
    const key = this.generateKey(url, params);
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  /**
   * Clear all cache entries matching URL pattern
   */
  invalidatePattern(urlPattern) {
    const keysToDelete = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(urlPattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.timestamps.delete(key);
    });
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
const apiCache = new APICache();

/**
 * Cached fetch wrapper
 * Automatically caches GET requests
 */
export async function cachedFetch(url, options = {}) {
  const method = options.method || 'GET';
  
  // Only cache GET requests
  if (method !== 'GET') {
    return fetch(url, options);
  }
  
  // Check cache first
  const cached = apiCache.get(url, options.params);
  if (cached) {
    console.log(`[Cache HIT] ${url}`);
    return Promise.resolve(cached);
  }
  
  // Fetch from API
  console.log(`[Cache MISS] ${url}`);
  const response = await fetch(url, options);
  const data = await response.json();
  
  // Cache successful responses
  if (response.ok) {
    apiCache.set(url, options.params, data);
  }
  
  return data;
}

export default apiCache;
