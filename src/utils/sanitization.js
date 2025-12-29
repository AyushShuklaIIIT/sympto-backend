import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

// Create a JSDOM window for server-side DOMPurify
const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} dirty - Potentially unsafe HTML string
 * @returns {string} Sanitized HTML string
 */
export const sanitizeHtml = (dirty) => {
  if (!dirty || typeof dirty !== 'string') {
    return dirty;
  }

  return purify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false
  });
};

/**
 * Sanitize text input by removing potentially dangerous characters
 * @param {string} input - User input string
 * @returns {string} Sanitized string
 */
export const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') {
    return input;
  }

  // Remove null bytes and control characters except newlines and tabs
  return input
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
    .trim();
};

/**
 * Sanitize object recursively
 * @param {any} obj - Object to sanitize
 * @param {Object} options - Sanitization options
 * @returns {any} Sanitized object
 */
export const sanitizeObject = (obj, options = {}) => {
  const { 
    sanitizeHtmlFields = [], 
    sanitizeInputFields = [],
    skipFields = [] 
  } = options;

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (skipFields.includes(key)) {
        sanitized[key] = value;
        continue;
      }

      if (sanitizeHtmlFields.includes(key) && typeof value === 'string') {
        sanitized[key] = sanitizeHtml(value);
      } else if (sanitizeInputFields.includes(key) && typeof value === 'string') {
        sanitized[key] = sanitizeInput(value);
      } else {
        sanitized[key] = sanitizeObject(value, options);
      }
    }
    
    return sanitized;
  }

  return obj;
};

/**
 * Middleware to sanitize request body
 * @param {Object} options - Sanitization options
 * @returns {Function} Express middleware function
 */
export const sanitizeRequestBody = (options = {}) => {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body, {
        sanitizeHtmlFields: ['notes', 'insights', 'recommendations', 'riskFactors'],
        sanitizeInputFields: ['firstName', 'lastName', 'email'],
        skipFields: ['password'], // Don't sanitize passwords as they might contain special chars
        ...options
      });
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          req.query[key] = sanitizeInput(value);
        }
      }
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      for (const [key, value] of Object.entries(req.params)) {
        if (typeof value === 'string') {
          req.params[key] = sanitizeInput(value);
        }
      }
    }

    next();
  };
};

/**
 * Validate that input doesn't contain SQL injection patterns
 * @param {string} input - Input to validate
 * @returns {boolean} True if input is safe
 */
export const validateSqlInjection = (input) => {
  if (!input || typeof input !== 'string') {
    return true;
  }

  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|\/\*|\*\/|;|'|"|`)/,
    /(\bOR\b|\bAND\b).*?[=<>]/i
  ];

  return !sqlPatterns.some(pattern => pattern.test(input));
};

/**
 * Validate that input doesn't contain NoSQL injection patterns
 * @param {any} input - Input to validate
 * @returns {boolean} True if input is safe
 */
export const validateNoSqlInjection = (input) => {
  if (input === null || input === undefined) {
    return true;
  }

  if (typeof input === 'string') {
    const nosqlPatterns = [
      /\$where/i,
      /\$regex/i,
      /\$ne/i,
      /\$gt/i,
      /\$lt/i,
      /\$in/i,
      /\$nin/i,
      /\$exists/i,
      /\$or/i,
      /\$and/i
    ];

    return !nosqlPatterns.some(pattern => pattern.test(input));
  }

  if (typeof input === 'object') {
    for (const key in input) {
      if (key.startsWith('$') || !validateNoSqlInjection(input[key])) {
        return false;
      }
    }
  }

  return true;
};

/**
 * Middleware to prevent NoSQL injection
 * @returns {Function} Express middleware function
 */
export const preventNoSqlInjection = () => {
  return (req, res, next) => {
    const validateInput = (obj, path = '') => {
      if (!validateNoSqlInjection(obj)) {
        throw new Error(`Potential NoSQL injection detected in ${path || 'request'}`);
      }

      if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          validateInput(value, path ? `${path}.${key}` : key);
        }
      }
    };

    try {
      validateInput(req.body, 'body');
      validateInput(req.query, 'query');
      validateInput(req.params, 'params');
      next();
    } catch (error) {
      console.error('NoSQL injection attempt detected:', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        method: req.method,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid input detected',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};