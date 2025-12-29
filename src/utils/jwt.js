import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

/**
 * Generate JWT access token
 * @param {Object} payload - Token payload (usually user ID)
 * @returns {string} JWT token
 */
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'sympto-api',
    audience: 'sympto-client'
  });
};

/**
 * Generate JWT refresh token
 * @param {Object} payload - Token payload (usually user ID)
 * @returns {string} JWT refresh token
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'sympto-api',
    audience: 'sympto-client'
  });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'sympto-api',
      audience: 'sympto-client'
    });
  } catch (error) {
    console.log(error);
    throw new Error('Invalid or expired token');
  }
};

/**
 * Generate secure random token for email verification and password reset
 * @returns {string} Random token
 */
export const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create token response object
 * @param {Object} user - User object
 * @returns {Object} Token response with access and refresh tokens
 */
export const createTokenResponse = (user) => {
  const payload = { 
    userId: user._id, 
    email: user.email,
    emailVerified: user.emailVerified 
  };
  
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  
  return {
    accessToken,
    refreshToken,
    expiresIn: JWT_EXPIRES_IN,
    tokenType: 'Bearer'
  };
};