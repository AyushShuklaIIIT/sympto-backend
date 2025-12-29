/**
 * Caching middleware for performance optimization
 */

// In-memory cache for development (use Redis in production)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Simple in-memory cache middleware
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Function} Express middleware
 */
export const memoryCache = (ttl = CACHE_TTL) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `${req.method}:${req.originalUrl}:${req.user?.id || 'anonymous'}`;
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < ttl) {
      console.log(`Cache hit for ${key}`);
      return res.json(cached.data);
    }

    // Store original res.json
    const originalJson = res.json;

    // Override res.json to cache the response
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode === 200) {
        cache.set(key, {
          data,
          timestamp: Date.now()
        });

        // Clean up expired entries periodically
        if (cache.size > 1000) {
          cleanupCache();
        }
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Cache headers middleware for static resources
 * @param {number} maxAge - Max age in seconds
 * @returns {Function} Express middleware
 */
export const cacheHeaders = (maxAge = 3600) => {
  return (req, res, next) => {
    res.set({
      'Cache-Control': `public, max-age=${maxAge}`,
      'ETag': `"${Date.now()}"`,
      'Last-Modified': new Date().toUTCString()
    });
    next();
  };
};

/**
 * No-cache headers for sensitive endpoints
 * @returns {Function} Express middleware
 */
export const noCache = () => {
  return (req, res, next) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });
    next();
  };
};

/**
 * Clean up expired cache entries
 */
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}

/**
 * Clear cache for specific patterns
 * @param {string} pattern - Pattern to match keys
 */
export const invalidateCache = (pattern) => {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
};

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export const getCacheStats = () => {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
};