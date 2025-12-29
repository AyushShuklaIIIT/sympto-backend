import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Assessment from '../models/Assessment.js';
import { 
  authenticate, 
  requireEmailVerification, 
  authenticateAndVerifyEmail 
} from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private (requires authentication)
 */
router.get('/profile', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          email: req.user.email,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          dateOfBirth: req.user.dateOfBirth,
          emailVerified: req.user.emailVerified,
          lastLogin: req.user.lastLogin,
          createdAt: req.user.createdAt,
          updatedAt: req.user.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_FETCH_FAILED',
        message: 'Failed to fetch user profile',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private (requires authentication)
 */
router.put('/profile', authenticate, [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid profile data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const { firstName, lastName, dateOfBirth, email } = req.body;
    const updateData = {};

    // Only update provided fields
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = new Date(dateOfBirth);
    
    // Handle email change (requires re-verification)
    if (email !== undefined && email !== req.user.email) {
      // Check if email is already taken
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: req.user._id }
      });
      
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'Email address is already in use',
            timestamp: new Date().toISOString()
          }
        });
      }

      updateData.email = email.toLowerCase();
      updateData.emailVerified = false; // Require re-verification for new email
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: updatedUser._id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          dateOfBirth: updatedUser.dateOfBirth,
          emailVerified: updatedUser.emailVerified,
          lastLogin: updatedUser.lastLogin,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_UPDATE_FAILED',
        message: 'Failed to update profile',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route   GET /api/users/export
 * @desc    Export user data (GDPR compliance)
 * @access  Private (requires authentication and email verification)
 */
router.get('/export', authenticateAndVerifyEmail, async (req, res) => {
  try {
    // Get user data
    const user = await User.findById(req.user._id).lean();
    
    // Get user's assessments
    const assessments = await Assessment.find({ userId: req.user._id }).lean();

    // Remove sensitive fields
    delete user.password;
    delete user.emailVerificationToken;
    delete user.emailVerificationExpires;
    delete user.passwordResetToken;
    delete user.passwordResetExpires;

    const exportData = {
      user,
      assessments,
      exportedAt: new Date().toISOString(),
      dataVersion: '1.0'
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="sympto-data-export-${Date.now()}.json"`);
    
    res.json({
      success: true,
      data: exportData
    });

  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATA_EXPORT_FAILED',
        message: 'Failed to export user data',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route   DELETE /api/users/account
 * @desc    Delete user account and all associated data
 * @access  Private (requires authentication and email verification)
 */
router.delete('/account', authenticateAndVerifyEmail, [
  body('confirmPassword')
    .notEmpty()
    .withMessage('Password confirmation is required for account deletion')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password confirmation is required',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const { confirmPassword } = req.body;

    // Verify password before deletion
    const user = await User.findById(req.user._id).select('+password');
    const isPasswordValid = await user.comparePassword(confirmPassword);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Invalid password confirmation',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Delete all user assessments
    const assessmentDeletionResult = await Assessment.deleteMany({ userId: req.user._id });
    
    // Delete user account
    await User.findByIdAndDelete(req.user._id);

    res.json({
      success: true,
      message: 'Account deleted successfully',
      data: {
        deletedAssessments: assessmentDeletionResult.deletedCount,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ACCOUNT_DELETION_FAILED',
        message: 'Failed to delete account',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route   POST /api/users/change-password
 * @desc    Change user password
 * @access  Private (requires authentication)
 */
router.post('/change-password', authenticate, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid password data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    
    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Current password is incorrect',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if new password is different from current
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SAME_PASSWORD',
          message: 'New password must be different from current password',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PASSWORD_CHANGE_FAILED',
        message: 'Failed to change password',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;