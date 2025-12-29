import express from 'express';
import { body, validationResult } from 'express-validator';
import Consent from '../models/Consent.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/consent
 * @desc    Get user's current consent preferences
 * @access  Private (requires authentication)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const consent = await Consent.findOrCreateForUser(req.user._id);
    
    res.json({
      success: true,
      data: {
        consent: consent.getCurrentConsent()
      }
    });
  } catch (error) {
    console.error('Get consent error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONSENT_FETCH_FAILED',
        message: 'Failed to fetch consent preferences',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route   PUT /api/consent
 * @desc    Update user's consent preferences
 * @access  Private (requires authentication)
 */
router.put('/', authenticate, [
  body('analytics')
    .optional()
    .isBoolean()
    .withMessage('Analytics consent must be a boolean value'),
  body('communications')
    .optional()
    .isBoolean()
    .withMessage('Communications consent must be a boolean value'),
  body('research')
    .optional()
    .isBoolean()
    .withMessage('Research consent must be a boolean value')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid consent data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const { analytics, communications, research } = req.body;
    const preferences = {};
    
    // Only update provided preferences
    if (analytics !== undefined) preferences.analytics = analytics;
    if (communications !== undefined) preferences.communications = communications;
    if (research !== undefined) preferences.research = research;

    // Get client information for audit trail
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const consent = await Consent.updateConsent(
      req.user._id, 
      preferences, 
      ipAddress, 
      userAgent
    );

    res.json({
      success: true,
      message: 'Consent preferences updated successfully',
      data: {
        consent: consent.getCurrentConsent()
      }
    });

  } catch (error) {
    console.error('Update consent error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONSENT_UPDATE_FAILED',
        message: 'Failed to update consent preferences',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route   GET /api/consent/history
 * @desc    Get user's consent history (for transparency)
 * @access  Private (requires authentication)
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const consent = await Consent.findOne({ userId: req.user._id });
    
    if (!consent) {
      return res.json({
        success: true,
        data: {
          history: []
        }
      });
    }

    // Return consent history without sensitive information
    const history = consent.consentHistory.map(entry => ({
      consentType: entry.consentType,
      granted: entry.granted,
      timestamp: entry.timestamp
      // Exclude IP address and user agent for privacy
    }));

    res.json({
      success: true,
      data: {
        history: history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      }
    });

  } catch (error) {
    console.error('Get consent history error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONSENT_HISTORY_FAILED',
        message: 'Failed to fetch consent history',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route   POST /api/consent/withdraw-all
 * @desc    Withdraw all non-essential consent (GDPR right)
 * @access  Private (requires authentication)
 */
router.post('/withdraw-all', authenticate, async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const consent = await Consent.updateConsent(
      req.user._id,
      {
        analytics: false,
        communications: false,
        research: false
      },
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: 'All non-essential consent withdrawn successfully',
      data: {
        consent: consent.getCurrentConsent()
      }
    });

  } catch (error) {
    console.error('Withdraw consent error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONSENT_WITHDRAWAL_FAILED',
        message: 'Failed to withdraw consent',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;