/**
 * Performance monitoring utilities
 */

/**
 * Performance monitoring middleware
 */
export const performanceMonitor = (req, res, next) => {
  const start = Date.now();
  
  // Override res.end to measure response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn(`Slow request detected: ${req.method} ${req.path} - ${duration}ms`);
    }
    
    // Add performance headers
    res.set('X-Response-Time', `${duration}ms`);
    
    originalEnd.apply(this, args);
  };
  
  next();
};

/**
 * Database query performance wrapper
 */
export const measureQuery = async (queryName, queryFn) => {
  const start = Date.now();
  try {
    const result = await queryFn();
    const duration = Date.now() - start;
    
    if (duration > 500) {
      console.warn(`Slow query detected: ${queryName} - ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`Query failed: ${queryName} - ${duration}ms`, error);
    throw error;
  }
};

/**
 * Memory usage monitoring
 */
export const getMemoryUsage = () => {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
    external: Math.round(usage.external / 1024 / 1024 * 100) / 100 // MB
  };
};

/**
 * API response optimization
 */
export const optimizeResponse = (data, options = {}) => {
  const { 
    excludeFields = [], 
    includeFields = null,
    maxDepth = 3 
  } = options;
  
  if (!data) return data;
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => optimizeResponse(item, options));
  }
  
  // Handle objects
  if (typeof data === 'object' && data !== null) {
    const optimized = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Skip excluded fields
      if (excludeFields.includes(key)) continue;
      
      // Only include specified fields if includeFields is set
      if (includeFields && !includeFields.includes(key)) continue;
      
      // Limit recursion depth
      if (maxDepth > 0 && typeof value === 'object' && value !== null) {
        optimized[key] = optimizeResponse(value, { 
          ...options, 
          maxDepth: maxDepth - 1 
        });
      } else {
        optimized[key] = value;
      }
    }
    
    return optimized;
  }
  
  return data;
};