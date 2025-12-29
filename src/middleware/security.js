import mongoSanitize from 'express-mongo-sanitize';
import { sanitizeRequestBody, preventNoSqlInjection } from '../utils/sanitization.js';

/**
 * HTTPS enforcement middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const enforceHTTPS = (req, res, next) => {
  // Skip in development or if already HTTPS
  if (process.env.NODE_ENV !== 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https') {
    return next();
  }

  // Redirect to HTTPS
  const httpsUrl = `https://${req.get('host')}${req.url}`;
  return res.redirect(301, httpsUrl);
};

/**
 * Enhanced security headers middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy (formerly Feature Policy)
  res.setHeader('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );
  
  // Expect-CT header for certificate transparency
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Expect-CT', 'max-age=86400, enforce');
  }
  
  // Cross-Origin Embedder Policy
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  
  // Cross-Origin Opener Policy
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  
  // Cross-Origin Resource Policy
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  
  next();
};

/**
 * Request size limiting middleware
 * @param {Object} options - Size limit options
 * @returns {Function} Express middleware function
 */
export const limitRequestSize = (options = {}) => {
  const { 
    maxBodySize = '10mb',
    maxParameterLength = 1000,
    maxParameters = 100 
  } = options;

  return (req, res, next) => {
    // Check parameter count
    const paramCount = Object.keys(req.query || {}).length + Object.keys(req.params || {}).length;
    if (paramCount > maxParameters) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOO_MANY_PARAMETERS',
          message: 'Too many parameters in request',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check parameter length
    const allParams = { ...req.query, ...req.params };
    for (const [key, value] of Object.entries(allParams)) {
      if (typeof value === 'string' && value.length > maxParameterLength) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'PARAMETER_TOO_LONG',
            message: `Parameter '${key}' exceeds maximum length`,
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    next();
  };
};

/**
 * Request logging middleware for security monitoring
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /javascript:/i,  // JavaScript protocol
    /data:/i,  // Data protocol
    /vbscript:/i,  // VBScript protocol
  ];

  const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(fullUrl) || pattern.test(userAgent) || 
    (req.body && typeof req.body === 'string' && pattern.test(req.body))
  );

  if (isSuspicious) {
    console.warn('Suspicious request detected:', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent,
      body: req.body ? JSON.stringify(req.body).substring(0, 500) : null
    });
  }

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    // Log slow requests (potential DoS)
    if (duration > 5000) {
      console.warn('Slow request detected:', {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode: res.statusCode
      });
    }

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Rate limiting for sensitive endpoints
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware function
 */
export const sensitiveEndpointLimiter = (options = {}) => {
  const { 
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 3, // 3 attempts per window
    message = 'Too many attempts, please try again later'
  } = options;

  const attempts = new Map();

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    
    // Clean old entries
    for (const [ip, data] of attempts.entries()) {
      if (now - data.firstAttempt > windowMs) {
        attempts.delete(ip);
      }
    }

    const userAttempts = attempts.get(key);
    
    if (!userAttempts) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    if (now - userAttempts.firstAttempt > windowMs) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    if (userAttempts.count >= max) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfter: Math.ceil((userAttempts.firstAttempt + windowMs - now) / 1000),
          timestamp: new Date().toISOString()
        }
      });
    }

    userAttempts.count++;
    next();
  };
};

/**
 * Content Security Policy middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const contentSecurityPolicy = (req, res, next) => {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "child-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "manifest-src 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  next();
};

/**
 * Combined security middleware stack
 */
export const securityMiddleware = [
  enforceHTTPS,
  securityHeaders,
  contentSecurityPolicy,
  securityLogger,
  limitRequestSize(),
  mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      console.warn(`Sanitized key '${key}' in request from ${req.ip}`);
    }
  }),
  preventNoSqlInjection(),
  sanitizeRequestBody()
];

/**
 * Security middleware for sensitive endpoints (auth, password reset, etc.)
 */
export const sensitiveSecurityMiddleware = [
  ...securityMiddleware,
  sensitiveEndpointLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many authentication attempts, please try again later'
  })
];