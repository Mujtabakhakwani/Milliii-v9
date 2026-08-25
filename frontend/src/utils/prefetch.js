/**
 * Prefetching utility for faster navigation
 * Preloads data and components before user navigates
 */

import React from 'react';
import axios from 'axios';
import { API_URL } from '../config';

class PrefetchManager {
  constructor() {
    this.cache = new Map();
    this.pending = new Set();
    this.observers = new Map();
  }

  /**
   * Prefetch data for a route
   */
  async prefetchRoute(route, getData) {
    // Skip if already cached or pending
    if (this.cache.has(route) || this.pending.has(route)) {
      return;
    }

    this.pending.add(route);

    try {
      const data = await getData();
      this.cache.set(route, {
        data,
        timestamp: Date.now()
      });
      console.log(`[Prefetch] Cached data for ${route}`);
    } catch (error) {
      console.error(`[Prefetch] Failed to prefetch ${route}:`, error);
    } finally {
      this.pending.delete(route);
    }
  }

  /**
   * Get prefetched data
   */
  getPrefetched(route, maxAge = 5 * 60 * 1000) {
    const cached = this.cache.get(route);
    
    if (!cached) return null;
    
    // Check if cache is still fresh
    const age = Date.now() - cached.timestamp;
    if (age > maxAge) {
      this.cache.delete(route);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Clear prefetched data
   */
  clear(route) {
    if (route) {
      this.cache.delete(route);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Prefetch on hover (for link preloading)
   */
  setupHoverPrefetch(element, route, getData) {
    if (this.observers.has(element)) return;

    let timeoutId;

    const handleMouseEnter = () => {
      // Wait 100ms before prefetching (avoid accidental hovers)
      timeoutId = setTimeout(() => {
        this.prefetchRoute(route, getData);
      }, 100);
    };

    const handleMouseLeave = () => {
      clearTimeout(timeoutId);
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    this.observers.set(element, { handleMouseEnter, handleMouseLeave });
  }

  /**
   * Cleanup hover prefetch
   */
  cleanupHoverPrefetch(element) {
    const observers = this.observers.get(element);
    if (observers) {
      element.removeEventListener('mouseenter', observers.handleMouseEnter);
      element.removeEventListener('mouseleave', observers.handleMouseLeave);
      this.observers.delete(element);
    }
  }

  /**
   * Prefetch on visible (Intersection Observer)
   */
  setupVisiblePrefetch(element, route, getData) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.prefetchRoute(route, getData);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(element);
    
    return () => observer.unobserve(element);
  }
}

// Singleton instance
const prefetchManager = new PrefetchManager();

/**
 * Prefetch common routes
 */
export async function prefetchDashboard() {
  return prefetchManager.prefetchRoute('/dashboard', async () => {
    const [projects, tasks, users] = await Promise.all([
      axios.get(`${API_URL}/projects?page=1&limit=10`),
      axios.get(`${API_URL}/tasks?page=1&limit=10`),
      axios.get(`${API_URL}/users?page=1&limit=10`)
    ]);
    
    return { projects: projects.data, tasks: tasks.data, users: users.data };
  });
}

export async function prefetchProjects() {
  return prefetchManager.prefetchRoute('/projects', async () => {
    const response = await axios.get(`${API_URL}/projects?page=1&limit=20`);
    return response.data;
  });
}

export async function prefetchMyTasks() {
  return prefetchManager.prefetchRoute('/my-tasks', async () => {
    const response = await axios.get(`${API_URL}/my-tasks`);
    return response.data;
  });
}

export async function prefetchChats() {
  return prefetchManager.prefetchRoute('/chats', async () => {
    const response = await axios.get(`${API_URL}/channels`);
    return response.data;
  });
}

/**
 * React hook for prefetching
 */
export function usePrefetch() {
  const prefetch = {
    dashboard: prefetchDashboard,
    projects: prefetchProjects,
    myTasks: prefetchMyTasks,
    chats: prefetchChats,
    
    // Get prefetched data
    get: (route) => prefetchManager.getPrefetched(route),
    
    // Clear cache
    clear: (route) => prefetchManager.clear(route)
  };
  
  return prefetch;
}

/**
 * Link component with hover prefetching
 */
export function PrefetchLink({ to, children, onPrefetch, ...props }) {
  const linkRef = React.useRef();
  
  React.useEffect(() => {
    if (!linkRef.current || !onPrefetch) return;
    
    prefetchManager.setupHoverPrefetch(linkRef.current, to, onPrefetch);
    
    return () => {
      prefetchManager.cleanupHoverPrefetch(linkRef.current);
    };
  }, [to, onPrefetch]);
  
  return (
    <a ref={linkRef} {...props}>
      {children}
    </a>
  );
}

export default prefetchManager;
