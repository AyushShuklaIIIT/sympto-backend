/**
 * AI Service for health assessment analysis
 * Handles communication with external AI model for health insights
 */
import { decryptHealthData } from '../utils/encryption.js';

class AIService {
  constructor() {
    // Expect a base URL like: https://nutritionfastapi.onrender.com
    // (or optionally the full endpoint https://nutritionfastapi.onrender.com/predict)
    this.baseUrl = process.env.AI_MODEL_URL || 'https://nutritionfastapi.onrender.com';
    // Optional (FastAPI deployment may not require auth)
    this.apiKey = process.env.AI_API_KEY;
    this.timeout = Number.parseInt(process.env.AI_TIMEOUT, 10) || 30000; // 30 seconds default
    this.maxRetries = Number.parseInt(process.env.AI_MAX_RETRIES, 10) || 3;
    this.retryDelay = Number.parseInt(process.env.AI_RETRY_DELAY, 10) || 1000; // 1 second default
  }

  /**
   * Format assessment data for AI model consumption
   * @param {Object} assessment - Assessment object from database
   * @returns {Object} Formatted data for AI model
   */
  formatAssessmentForAI(assessment) {
    // Lab fields are encrypted at rest. When analysis runs immediately after a save,
    // the in-memory document contains ciphertext strings. Decrypt them before
    // sending to the AI endpoint to avoid NaN/null payloads.
    const decryptedLabs = decryptHealthData({
      hemoglobin: assessment.hemoglobin,
      ferritin: assessment.ferritin,
      vitamin_b12: assessment.vitamin_b12,
      vitamin_d: assessment.vitamin_d,
      calcium: assessment.calcium
    });

    return {
      // Flat payload expected by the ML endpoint.
      fatigue: Number(assessment.fatigue),
      hair_loss: Number(assessment.hair_loss),
      acidity: Number(assessment.acidity),
      dizziness: Number(assessment.dizziness),
      muscle_pain: Number(assessment.muscle_pain),
      numbness: Number(assessment.numbness),
      vegetarian: Number(assessment.vegetarian),
      iron_food_freq: Number(assessment.iron_food_freq),
      dairy_freq: Number(assessment.dairy_freq),
      sunlight_min: Number(assessment.sunlight_min),
      junk_food_freq: Number(assessment.junk_food_freq),
      smoking: Number(assessment.smoking),
      alcohol: Number(assessment.alcohol),
      hemoglobin: Number(decryptedLabs.hemoglobin),
      ferritin: Number(decryptedLabs.ferritin),
      vitamin_b12: Number(decryptedLabs.vitamin_b12),
      vitamin_d: Number(decryptedLabs.vitamin_d),
      calcium: Number(decryptedLabs.calcium)
    };
  }

  /**
   * Validate AI model response format
   * @param {Object} response - Response from AI model
   * @returns {boolean} True if response is valid
   */
  validateAIResponse(response) {
    // The FastAPI ML endpoint returns structured numeric outputs (deficiency flags, severity, etc).
    // We keep this permissive: just ensure we got a JSON object.
    return Boolean(response) && typeof response === 'object';
  }

  extractModelOutputs(aiResponse) {
    const OUTPUT_KEYS = [
      'iron_def',
      'b12_def',
      'vitd_def',
      'calcium_def',
      'severity',
      'magnesium_def',
      'potassium_def',
      'protein_def',
      'zinc_def',
      'folate_def',
      'omega3_def',
      'electrolyte_imbalance',
      'general_malnutrition',
      'vitamin_b6_def',
      'copper_def',
      'selenium_def',
      'iodine_def',
      'vitamin_a_def',
      'choline_def',
      'gut_malabsorption',
      'chronic_inflammation',
      'chronic_dehydration',
      'protein_quality_def'
    ];

    const candidate =
      (aiResponse && typeof aiResponse.prediction1 === 'object' && aiResponse.prediction1) ||
      (aiResponse && typeof aiResponse.outputs === 'object' && aiResponse.outputs) ||
      (aiResponse && typeof aiResponse.modelOutputs === 'object' && aiResponse.modelOutputs) ||
      aiResponse;

    const modelOutputs = {};
    let hasAny = false;

    for (const key of OUTPUT_KEYS) {
      const raw = candidate?.[key];
      if (raw === undefined || raw === null || raw === '') continue;

      const asNumber = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(asNumber)) continue;

      modelOutputs[key] = asNumber;
      hasAny = true;
    }

    return hasAny ? modelOutputs : null;
  }

  extractModelTextOutputs(aiResponse) {
    const p2 = aiResponse && typeof aiResponse.prediction2 === 'object' ? aiResponse.prediction2 : null;
    const p3 = aiResponse && typeof aiResponse.prediction3 === 'object' ? aiResponse.prediction3 : null;

    const toStringOrNull = (value) => {
      if (value === undefined || value === null) return null;
      if (typeof value === 'string') return value;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    };

    const modelTextOutputs = {
      medicationBrandNames: toStringOrNull(p2?.Medication_Brand_Names ?? p2?.medicationBrandNames),
      medicationText: toStringOrNull(p2?.Medication_Text ?? p2?.medicationText),
      dietAdditions: toStringOrNull(p3?.Diet_Additions ?? p3?.dietAdditions),
      nutrientRequirements: toStringOrNull(p3?.Nutrient_Requirements ?? p3?.nutrientRequirements),
      vegetarianFoodMapping: toStringOrNull(p3?.Vegetarian_Food_Mapping ?? p3?.vegetarianFoodMapping),
      mandatoryDietChanges: toStringOrNull(p3?.Mandatory_Diet_Changes ?? p3?.mandatoryDietChanges)
    };

    const hasAny = Object.values(modelTextOutputs).some(v => v !== null && v !== '');
    return hasAny ? modelTextOutputs : null;
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make HTTP request to AI service with retry logic
   * @param {Object} data - Formatted assessment data
   * @param {number} attempt - Current attempt number (for retry logic)
    * @returns {Promise<Object>} AI analysis response
   */
  async makeAIRequest(data, attempt = 1) {
    // Use dynamic import for node-fetch to avoid Jest issues
    const fetch = (await import('node-fetch')).default;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = this.baseUrl.endsWith('/predict') ? this.baseUrl : `${this.baseUrl}/predict`;
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Sympto-Health-Platform/1.0'
      };
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI service responded with status ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      // Some wrappers return { prediction: <payload> }
      let payload = result?.prediction ?? result;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          // keep as-is
        }
      }
      if (Array.isArray(payload) && payload.length === 1) {
        payload = payload[0];
      }

      if (!this.validateAIResponse(payload)) {
        throw new Error('Invalid response format from AI service');
      }

      return payload;

    } catch (error) {
      clearTimeout(timeoutId);

      // Handle specific error types
      if (error.name === 'AbortError') {
        throw new Error(`AI service request timed out after ${this.timeout}ms`);
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error('AI service is unavailable');
      }

      // Retry logic for retryable errors
      if (attempt < this.maxRetries && this.isRetryableError(error)) {
        console.warn(`AI service request failed (attempt ${attempt}/${this.maxRetries}):`, error.message);
        await this.sleep(this.retryDelay * attempt); // Exponential backoff
        return this.makeAIRequest(data, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Determine if an error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean} True if error is retryable
   */
  isRetryableError(error) {
    // Retry on network errors, timeouts, and 5xx server errors
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /ECONNRESET/,
      /ETIMEDOUT/,
      /status 5\d\d/
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Analyze health assessment using AI model
   * @param {Object} assessment - Assessment object from database
    * @returns {Promise<Object>} AI analysis results
   */
  async analyzeAssessment(assessment) {
    try {
      // Validate input
      if (!assessment || typeof assessment !== 'object') {
        throw new Error('Invalid assessment data provided');
      }

      // Format data for AI model
      const formattedData = this.formatAssessmentForAI(assessment);

      const aiResponse = await this.makeAIRequest(formattedData);

      const modelOutputs = this.extractModelOutputs(aiResponse);
      const modelTextOutputs = this.extractModelTextOutputs(aiResponse);

      // Optional: if the service ever returns narrative fields, store them.
      const analysisResult =
        typeof aiResponse?.insights === 'string' &&
        Array.isArray(aiResponse?.recommendations) &&
        Array.isArray(aiResponse?.riskFactors) &&
        typeof aiResponse?.confidence === 'number'
          ? {
              insights: aiResponse.insights,
              recommendations: aiResponse.recommendations,
              riskFactors: aiResponse.riskFactors,
              confidence: aiResponse.confidence,
              processedAt: new Date(),
              modelVersion: aiResponse.metadata?.modelVersion || 'nutritionfastapi'
            }
          : null;

      // If the external service responded but doesn't provide usable outputs, fall back.
      if (!analysisResult && !modelOutputs && !modelTextOutputs) {
        throw new Error('AI service returned an empty or unsupported response');
      }

      return {
        success: true,
        data: analysisResult,
        modelOutputs,
        modelTextOutputs
      };

    } catch (error) {
      console.error('AI analysis error:', error);

      return {
        success: false,
        error: {
          code: this.getErrorCode(error),
          message: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Get appropriate error code based on error type
   * @param {Error} error - The error object
   * @returns {string} Error code
   */
  getErrorCode(error) {
    if (error.message.includes('timeout')) {
      return 'AI_SERVICE_TIMEOUT';
    }
    if (error.message.includes('unavailable')) {
      return 'AI_SERVICE_UNAVAILABLE';
    }
    if (error.message.includes('Invalid response format')) {
      return 'AI_RESPONSE_INVALID';
    }
    if (error.message.includes('API key')) {
      return 'AI_SERVICE_UNAUTHORIZED';
    }
    return 'AI_SERVICE_ERROR';
  }

  /**
   * Check AI service health
   * @returns {Object} Health check result
   */
  async healthCheck() {
    try {
      // Use dynamic import for node-fetch to avoid Jest issues
      const fetch = (await import('node-fetch')).default;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check

      const base = this.baseUrl.endsWith('/predict') ? this.baseUrl.slice(0, -'/predict'.length) : this.baseUrl;
      const headers = {
        'User-Agent': 'Sympto-Health-Platform/1.0'
      };
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${base}/health`, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      return {
        available: response.ok,
        status: response.status,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        available: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create singleton instance
const aiService = new AIService();

export default aiService;