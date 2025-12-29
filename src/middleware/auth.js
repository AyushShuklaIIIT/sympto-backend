import { verifyToken, createTokenResponse } from '../utils/jwt.js';
import User from '../models/User.js';

/**
 * Middleware to authenticate JWT tokens with automatic refresh handling
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify the token
    const decoded = verifyToken(token);
    
    // Get user from database
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_USER',
          message: 'User not found or inactive',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if token is close to expiration (within 1 hour)
    const tokenExp = decoded.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    if (tokenExp - now < oneHour) {
      // Token is close to expiration, include refresh info in response headers
      const newTokens = createTokenResponse(user);
      res.set('X-Token-Refresh', 'true');
      res.set('X-New-Access-Token', newTokens.accessToken);
      res.set('X-New-Refresh-Token', newTokens.refreshToken);
    }

    // Add user to request object
    req.user = user;
    req.userId = user._id;
    req.tokenInfo = {
      exp: decoded.exp,
      iat: decoded.iat,
      needsRefresh: tokenExp - now < oneHour
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid access token',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Middleware to require email verification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireEmailVerification = (req, res, next) => {
  // Allow turning off email verification gating for local/dev environments.
  // Default behavior:
  // - production: require verification
  // - non-production: do NOT require verification unless explicitly enabled
  const envFlag = (process.env.REQUIRE_EMAIL_VERIFICATION || '').toLowerCase();
  const explicitlyEnabled = envFlag === 'true' || envFlag === '1' || envFlag === 'yes';
  const explicitlyDisabled = envFlag === 'false' || envFlag === '0' || envFlag === 'no';
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction && !explicitlyEnabled) {
    return next();
  }
  if (explicitlyDisabled) {
    return next();
  }

  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email verification required',
        timestamp: new Date().toISOString()
      }
    });
  }
  
  next();
};

/**
 * Middleware to optionally authenticate (doesn't fail if no token)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);
    
    if (user && user.isActive) {
      req.user = user;
      req.userId = user._id;
      req.tokenInfo = {
        exp: decoded.exp,
        iat: decoded.iat,
        needsRefresh: (decoded.exp * 1000) - Date.now() < (60 * 60 * 1000)
      };
    }
    
    next();
  } catch (error) {
    console.log(error);
    next();
  }
};

/**
 * Middleware to handle token refresh requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const handleTokenRefresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken);
    
    // Get user from database
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_USER',
          message: 'User not found or inactive',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Generate new tokens
    const newTokens = createTokenResponse(user);
    
    res.json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified
        },
        ...newTokens
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'REFRESH_TOKEN_EXPIRED',
          message: 'Refresh token has expired',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid refresh token',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Middleware factory to create role-based access control
 * @param {Array} allowedRoles - Array of allowed roles
 * @returns {Function} Middleware function
 */
export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // If no roles specified, just require authentication
    if (allowedRoles.length === 0) {
      return next();
    }

    // Check if user has required role
    const userRole = req.user.role || 'user';
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions',
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  };
};

/**
 * Middleware to protect routes that require verified email
 * Combines authentication and email verification
 */
export const authenticateAndVerifyEmail = [authenticate, requireEmailVerification];

/**
 * Middleware to check if user owns the resource
 * @param {string} paramName - Name of the parameter containing the user ID
 * @returns {Function} Middleware function
 */
export const requireOwnership = (paramName = 'userId') => {
  return (req, res, next) => {
    const resourceUserId = req.params[paramName] || req.body[paramName];
    
    if (!resourceUserId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if the authenticated user owns the resource
    if (req.userId.toString() !== resourceUserId.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied to this resource',
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  };
};