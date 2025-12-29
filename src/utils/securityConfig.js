/**
 * Security Configuration Validation and Setup
 */

import crypto from 'crypto';
import fs from 'fs';
import https from 'https';

/**
 * Validate security configuration on startup
 */
export const validateSecurityConfig = () => {
  const errors = [];
  const warnings = [];

  // Check encryption key
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    errors.push('ENCRYPTION_KEY environment variable is required');
  } else if (encryptionKey.length < 32) {
    errors.push('ENCRYPTION_KEY must be at least 32 characters long');
  }

  // Check JWT secrets
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push('JWT_SECRET environment variable is required');
  } else if (jwtSecret.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters long for better security');
  }

  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!jwtRefreshSecret) {
    warnings.push('JWT_REFRESH_SECRET not set, using JWT_SECRET (not recommended)');
  } else if (jwtRefreshSecret.length < 32) {
    warnings.push('JWT_REFRESH_SECRET should be at least 32 characters long');
  }

  // Check session secret
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    warnings.push('SESSION_SECRET not set, sessions may be less secure');
  } else if (sessionSecret.length < 32) {
    warnings.push('SESSION_SECRET should be at least 32 characters long');
  }

  // Production-specific checks
  if (process.env.NODE_ENV === 'production') {
    // Check HTTPS configuration
    const httpsKeyPath = process.env.HTTPS_KEY_PATH;
    const httpsCertPath = process.env.HTTPS_CERT_PATH;
    
    if (!httpsKeyPath || !httpsCertPath) {
      warnings.push('HTTPS configuration not found. Ensure reverse proxy handles SSL termination.');
    } else {
      try {
        if (!fs.existsSync(httpsKeyPath)) {
          errors.push(`HTTPS private key file not found: ${httpsKeyPath}`);
        }
        if (!fs.existsSync(httpsCertPath)) {
          errors.push(`HTTPS certificate file not found: ${httpsCertPath}`);
        }
      } catch (error) {
        warnings.push('Could not validate HTTPS certificate files');
      }
    }

    // Check for development defaults
    if (jwtSecret && jwtSecret.includes('your-super-secret')) {
      errors.push('JWT_SECRET appears to be using default value. Change it for production.');
    }
    if (encryptionKey && encryptionKey.includes('your-32-character')) {
      errors.push('ENCRYPTION_KEY appears to be using default value. Change it for production.');
    }
  }

  return { errors, warnings };
};

/**
 * Generate secure random keys for development
 */
export const generateSecureKeys = () => {
  return {
    encryptionKey: crypto.randomBytes(32).toString('hex'),
    jwtSecret: crypto.randomBytes(64).toString('hex'),
    jwtRefreshSecret: crypto.randomBytes(64).toString('hex'),
    sessionSecret: crypto.randomBytes(64).toString('hex')
  };
};

/**
 * Create HTTPS server if certificates are available
 */
export const createSecureServer = (app) => {
  const httpsKeyPath = process.env.HTTPS_KEY_PATH;
  const httpsCertPath = process.env.HTTPS_CERT_PATH;

  if (httpsKeyPath && httpsCertPath) {
    try {
      const privateKey = fs.readFileSync(httpsKeyPath, 'utf8');
      const certificate = fs.readFileSync(httpsCertPath, 'utf8');
      
      const credentials = { key: privateKey, cert: certificate };
      return https.createServer(credentials, app);
    } catch (error) {
      console.error('Failed to create HTTPS server:', error.message);
      console.log('Falling back to HTTP server');
      return null;
    }
  }
  
  return null;
};

/**
 * Security headers for production
 */
export const getSecurityHeaders = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    // Strict Transport Security
    'Strict-Transport-Security': isProduction 
      ? 'max-age=31536000; includeSubDomains; preload'
      : 'max-age=0',
    
    // Content Security Policy
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "media-src 'none'",
      "frame-src 'none'",
      "child-src 'none'",
      "worker-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "manifest-src 'self'"
    ].join('; '),
    
    // Other security headers
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    
    // Production-only headers
    ...(isProduction && {
      'Expect-CT': 'max-age=86400, enforce',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin'
    })
  };
};

/**
 * Rate limiting configuration
 */
export const getRateLimitConfig = () => {
  return {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.',
        timestamp: new Date().toISOString()
      }
    },
    standardHeaders: true,
    legacyHeaders: false
  };
};

/**
 * Initialize security configuration
 */
export const initializeSecurity = () => {
  console.log('🔒 Initializing security configuration...');
  
  const { errors, warnings } = validateSecurityConfig();
  
  // Log warnings
  if (warnings.length > 0) {
    console.warn('⚠️  Security warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
  }
  
  // Handle errors
  if (errors.length > 0) {
    console.error('❌ Security configuration errors:');
    errors.forEach(error => console.error(`   - ${error}`));
    
    if (process.env.NODE_ENV === 'production') {
      console.error('Cannot start server with security configuration errors in production');
      process.exit(1);
    } else {
      console.warn('⚠️  Continuing in development mode despite security errors');
      console.warn('⚠️  Generate secure keys with: npm run generate-keys');
    }
  }
  
  console.log('✅ Security configuration initialized');
  
  return { errors, warnings };
};