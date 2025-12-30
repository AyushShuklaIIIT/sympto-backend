import express from 'express';
import aiService from '../services/aiService.js';

const router = express.Router();

/**
 * @route   GET /api/ai/health
 * @desc    Ping AI service health endpoint (useful to wake Render free instances)
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const healthStatus = await aiService.healthCheck();

    return res.json({
      success: true,
      data: {
        aiService: healthStatus
      }
    });
  } catch (error) {
    // For warmup purposes, we return 200 with healthy=false so the frontend can
    // fire-and-forget this call without triggering global error UI.
    return res.json({
      success: true,
      data: {
        aiService: {
          healthy: false,
          error: error?.message || 'AI health check failed',
          timestamp: new Date().toISOString()
        }
      }
    });
  }
});

export default router;
