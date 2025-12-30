import express from 'express';
import { body, validationResult } from 'express-validator';
import Assessment from '../models/Assessment.js';
import { 
  authenticate, 
  requireEmailVerification, 
  authenticateAndVerifyEmail,
  requireOwnership 
} from '../middleware/auth.js';
import aiService from '../services/aiService.js';

const router = express.Router();

/**
 * @route   POST /api/assessments
 * @desc    Create a new health assessment
 * @access  Private (requires authentication and email verification)
 */
router.post('/', authenticateAndVerifyEmail, [
  body('fatigue')
    .isInt({ min: 0, max: 3 })
    .withMessage('Fatigue must be a number between 0 and 3'),
  body('hair_loss')
    .isInt({ min: 0, max: 3 })
    .withMessage('Hair loss must be a number between 0 and 3'),
  body('acidity')
    .isInt({ min: 0, max: 3 })
    .withMessage('Acidity must be a number between 0 and 3'),
  body('dizziness')
    .isInt({ min: 0, max: 3 })
    .withMessage('Dizziness must be a number between 0 and 3'),
  body('muscle_pain')
    .isInt({ min: 0, max: 3 })
    .withMessage('Muscle pain must be a number between 0 and 3'),
  body('numbness')
    .isInt({ min: 0, max: 3 })
    .withMessage('Numbness must be a number between 0 and 3'),
  body('vegetarian')
    .isInt({ min: 0, max: 1 })
    .withMessage('Vegetarian must be 0 or 1'),
  body('iron_food_freq')
    .isInt({ min: 0, max: 3 })
    .withMessage('Iron food frequency must be between 0 and 3'),
  body('dairy_freq')
    .isInt({ min: 0, max: 3 })
    .withMessage('Dairy frequency must be between 0 and 3'),
  body('sunlight_min')
    .isInt({ min: 0, max: 65 })
    .withMessage('Sunlight minutes must be between 0 and 65 minutes per day'),
  body('junk_food_freq')
    .isInt({ min: 0, max: 3 })
    .withMessage('Junk food frequency must be between 0 and 3'),
  body('smoking')
    .isInt({ min: 0, max: 1 })
    .withMessage('Smoking must be 0 or 1'),
  body('alcohol')
    .isInt({ min: 0, max: 1 })
    .withMessage('Alcohol must be 0 or 1'),
  body('hemoglobin')
    .isFloat({ min: 7.2, max: 16.5 })
    .withMessage('Hemoglobin must be between 7.2 and 16.5 g/dL'),
  body('ferritin')
    .isFloat({ min: 4.5, max: 165 })
    .withMessage('Ferritin must be between 4.5 and 165 ng/mL'),
  body('vitamin_b12')
    .isFloat({ min: 108, max: 550 })
    .withMessage('Vitamin B12 must be between 108 and 550 pg/mL'),
  body('vitamin_d')
    .isFloat({ min: 4.5, max: 49.5 })
    .withMessage('Vitamin D must be between 4.5 and 49.5 ng/mL'),
  body('calcium')
    .isFloat({ min: 6.75, max: 11.22 })
    .withMessage('Calcium must be between 6.75 and 11.22 mg/dL')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid assessment data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    // Create assessment with user ID
    const assessmentData = {
      ...req.body,
      userId: req.userId
    };

    const assessment = new Assessment(assessmentData);
    
    // Check if assessment is complete and set status
    if (assessment.isComplete()) {
      assessment.status = 'completed';
    }
    
    await assessment.save();

    // If assessment is complete, trigger AI analysis asynchronously
    let aiAnalysisResult = null;
    if (assessment.status === 'completed') {
      try {
        const analysisResult = await aiService.analyzeAssessment(assessment);
        
        if (analysisResult.success) {
          if (analysisResult.data) {
            assessment.aiAnalysis = analysisResult.data;
          }
          if (analysisResult.modelOutputs) {
            assessment.modelOutputs = analysisResult.modelOutputs;
          }
          if (analysisResult.modelTextOutputs) {
            assessment.modelTextOutputs = analysisResult.modelTextOutputs;
          }
          assessment.status = 'analyzed';
          await assessment.save();
          aiAnalysisResult = assessment.aiAnalysis;
        } else {
          // Log AI analysis failure but don't fail the assessment creation
          console.warn('AI analysis failed for assessment:', assessment._id, analysisResult.error);
        }
      } catch (error) {
        // Log AI analysis error but don't fail the assessment creation
        console.warn('AI analysis error for assessment:', assessment._id, error.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Assessment created successfully',
      data: {
        assessment: {
          id: assessment._id,
          userId: assessment.userId,
          status: assessment.status,
          createdAt: assessment.createdAt,
          completedAt: assessment.completedAt,
          aiAnalysis: aiAnalysisResult,
          modelOutputs: assessment.modelOutputs,
          modelTextOutputs: assessment.modelTextOutputs,
          // Include all assessment fields
          ...req.body
        }
      }
    });

  } catch (error) {
    console.error('Assessment creation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ASSESSMENT_CREATION_FAILED',
        message: 'Failed to create assessment',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route   GET /api/assessments
 * @desc    Get user's assessment history
 * @access  Private (requires authentication)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const assessments = await Assessment.find({ userId: req.userId })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Assessment.countDocuments({ userId: req.userId });

    res.json({
      success: true,
      data: {
        assessments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Assessment retrieval error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ASSESSMENT_RETRIEVAL_FAILED',
        message: 'Failed to retrieve assessments',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route   GET /api/assessments/:id
 * @desc    Get specific assessment by ID
 * @access  Private (requires authentication and ownership)
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ASSESSMENT_NOT_FOUND',
          message: 'Assessment not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check ownership
    if (assessment.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied to this assessment',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: {
        assessment
      }
    });

  } catch (error) {
    console.error('Assessment retrieval error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ASSESSMENT_ID',
          message: 'Invalid assessment ID format',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'ASSESSMENT_RETRIEVAL_FAILED',
        message: 'Failed to retrieve assessment',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route   DELETE /api/assessments/:id
 * @desc    Delete specific assessment
 * @access  Private (requires authentication and ownership)
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ASSESSMENT_NOT_FOUND',
          message: 'Assessment not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check ownership
    if (assessment.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied to this assessment',
          timestamp: new Date().toISOString()
        }
      });
    }

    await Assessment.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Assessment deleted successfully'
    });

  } catch (error) {
    console.error('Assessment deletion error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ASSESSMENT_ID',
          message: 'Invalid assessment ID format',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'ASSESSMENT_DELETION_FAILED',
        message: 'Failed to delete assessment',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route   DELETE /api/assessments
 * @desc    Delete all user assessments
 * @access  Private (requires authentication and email verification)
 */
router.delete('/', authenticateAndVerifyEmail, async (req, res) => {
  try {
    const result = await Assessment.deleteMany({ userId: req.userId });

    res.json({
      success: true,
      message: `${result.deletedCount} assessments deleted successfully`,
      data: {
        deletedCount: result.deletedCount
      }
    });

  } catch (error) {
    console.error('Assessment bulk deletion error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ASSESSMENT_DELETION_FAILED',
        message: 'Failed to delete assessments',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route   POST /api/assessments/:id/analyze
 * @desc    Trigger AI analysis for a specific assessment
 * @access  Private (requires authentication and ownership)
 */
router.post('/:id/analyze', authenticate, async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ASSESSMENT_NOT_FOUND',
          message: 'Assessment not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check ownership
    if (assessment.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied to this assessment',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if assessment is complete
    if (!assessment.isComplete()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ASSESSMENT_INCOMPLETE',
          message: 'Assessment must be complete before AI analysis',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if already analyzed recently (prevent spam)
    if (assessment.aiAnalysis?.processedAt) {
      const timeSinceLastAnalysis = Date.now() - assessment.aiAnalysis.processedAt.getTime();
      const minInterval = 5 * 60 * 1000; // 5 minutes
      
      if (timeSinceLastAnalysis < minInterval) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'ANALYSIS_TOO_FREQUENT',
            message: 'Please wait before requesting another analysis',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // Perform AI analysis
    const analysisResult = await aiService.analyzeAssessment(assessment);

    if (!analysisResult.success) {
      return res.status(503).json({
        success: false,
        error: {
          code: analysisResult.error.code,
          message: analysisResult.error.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Update assessment with AI results
    if (analysisResult.data) {
      assessment.aiAnalysis = analysisResult.data;
    }
    if (analysisResult.modelOutputs) {
      assessment.modelOutputs = analysisResult.modelOutputs;
    }
    if (analysisResult.modelTextOutputs) {
      assessment.modelTextOutputs = analysisResult.modelTextOutputs;
    }
    assessment.status = 'analyzed';
    await assessment.save();

    res.json({
      success: true,
      message: 'AI analysis completed successfully',
      data: {
        assessment: {
          id: assessment._id,
          aiAnalysis: assessment.aiAnalysis,
          modelOutputs: assessment.modelOutputs,
          modelTextOutputs: assessment.modelTextOutputs,
          status: assessment.status
        }
      }
    });

  } catch (error) {
    console.error('AI analysis endpoint error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ASSESSMENT_ID',
          message: 'Invalid assessment ID format',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'AI_ANALYSIS_FAILED',
        message: 'Failed to perform AI analysis',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route   GET /api/assessments/ai/health
 * @desc    Check AI service health status
 * @access  Private (requires authentication)
 */
router.get('/ai/health', authenticate, async (req, res) => {
  try {
    const healthStatus = await aiService.healthCheck();
    
    res.json({
      success: true,
      data: {
        aiService: healthStatus
      }
    });

  } catch (error) {
    console.error('AI health check error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Failed to check AI service health',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;