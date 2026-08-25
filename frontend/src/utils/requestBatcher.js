/**
 * Request Batcher - DataLoader pattern for frontend
 * Batches multiple API requests into fewer network calls
 * Dramatically reduces server load and improves performance
 */

class RequestBatcher {
  constructor(batchFunction, options = {}) {
    this.batchFunction = batchFunction;
    this.maxBatchSize = options.maxBatchSize || 50;
    this.batchWindow = options.batchWindow || 10; // milliseconds
    
    this.queue = [];
    this.timer = null;
  }

  /**
   * Load a single item (will be batched)
   */
  load(key) {
    return new Promise((resolve, reject) => {
      this.queue.push({ key, resolve, reject });
      
      // Schedule batch if not already scheduled
      if (!this.timer) {
        this.timer = setTimeout(() => {
          this.executeBatch();
        }, this.batchWindow);
      }
      
      // Execute immediately if batch is full
      if (this.queue.length >= this.maxBatchSize) {
        clearTimeout(this.timer);
        this.timer = null;
        this.executeBatch();
      }
    });
  }

  /**
   * Execute the batched requests
   */
  async executeBatch() {
    const batch = this.queue.splice(0, this.maxBatchSize);
    this.timer = null;
    
    if (batch.length === 0) return;
    
    const keys = batch.map(item => item.key);
    
    try {
      // Call the batch function with all keys
      const results = await this.batchFunction(keys);
      
      // Resolve individual promises
      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      // Reject all promises on error
      batch.forEach(item => {
        item.reject(error);
      });
    }
    
    // Process remaining queue if any
    if (this.queue.length > 0) {
      this.timer = setTimeout(() => {
        this.executeBatch();
      }, this.batchWindow);
    }
  }

  /**
   * Clear pending batch
   */
  clear() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.queue = [];
  }
}

/**
 * Create a user data loader
 * Batches multiple user fetches into single request
 */
export function createUserLoader(apiClient) {
  return new RequestBatcher(async (userIds) => {
    // Fetch all users in one request
    const response = await apiClient.post('/api/users/batch', { ids: userIds });
    
    // Return results in same order as input
    return userIds.map(id => 
      response.data.find(user => user.id === id)
    );
  }, {
    maxBatchSize: 50,
    batchWindow: 10
  });
}

/**
 * Create a project data loader
 */
export function createProjectLoader(apiClient) {
  return new RequestBatcher(async (projectIds) => {
    const response = await apiClient.post('/api/projects/batch', { ids: projectIds });
    return projectIds.map(id => 
      response.data.find(project => project.id === id)
    );
  }, {
    maxBatchSize: 30,
    batchWindow: 15
  });
}

/**
 * Create a task data loader
 */
export function createTaskLoader(apiClient) {
  return new RequestBatcher(async (taskIds) => {
    const response = await apiClient.post('/api/tasks/batch', { ids: taskIds });
    return taskIds.map(id => 
      response.data.find(task => task.id === id)
    );
  }, {
    maxBatchSize: 100,
    batchWindow: 10
  });
}

/**
 * Usage example:
 * 
 * const userLoader = createUserLoader(axios);
 * 
 * // These 3 calls will be batched into 1 request
 * const user1 = await userLoader.load('user-id-1');
 * const user2 = await userLoader.load('user-id-2');
 * const user3 = await userLoader.load('user-id-3');
 * 
 * // Instead of 3 requests, only 1 is made:
 * // POST /api/users/batch { ids: ['user-id-1', 'user-id-2', 'user-id-3'] }
 */

export default RequestBatcher;
