import mongoose from 'mongoose';
import { encryptHealthData, decryptHealthData } from '../utils/encryption.js';

const assessmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  
  // Symptoms (ordinal scale 0-3)
  fatigue: {
    type: Number,
    required: [true, 'Fatigue level is required'],
    min: [0, 'Fatigue level must be between 0 and 3'],
    max: [3, 'Fatigue level must be between 0 and 3'],
    validate: {
      validator: Number.isInteger,
      message: 'Fatigue level must be an integer'
    }
  },
  hair_loss: {
    type: Number,
    required: [true, 'Hair loss level is required'],
    min: [0, 'Hair loss level must be between 0 and 3'],
    max: [3, 'Hair loss level must be between 0 and 3'],
    validate: {
      validator: Number.isInteger,
      message: 'Hair loss level must be an integer'
    }
  },
  acidity: {
    type: Number,
    required: [true, 'Acidity level is required'],
    min: [0, 'Acidity level must be between 0 and 3'],
    max: [3, 'Acidity level must be between 0 and 3'],
    validate: {
      validator: Number.isInteger,
      message: 'Acidity level must be an integer'
    }
  },
  dizziness: {
    type: Number,
    required: [true, 'Dizziness level is required'],
    min: [0, 'Dizziness level must be between 0 and 3'],
    max: [3, 'Dizziness level must be between 0 and 3'],
    validate: {
      validator: Number.isInteger,
      message: 'Dizziness level must be an integer'
    }
  },
  muscle_pain: {
    type: Number,
    required: [true, 'Muscle pain level is required'],
    min: [0, 'Muscle pain level must be between 0 and 3'],
    max: [3, 'Muscle pain level must be between 0 and 3'],
    validate: {
      validator: Number.isInteger,
      message: 'Muscle pain level must be an integer'
    }
  },
  numbness: {
    type: Number,
    required: [true, 'Numbness level is required'],
    min: [0, 'Numbness level must be between 0 and 3'],
    max: [3, 'Numbness level must be between 0 and 3'],
    validate: {
      validator: Number.isInteger,
      message: 'Numbness level must be an integer'
    }
  },
  
  // Lifestyle factors
  vegetarian: {
    type: Number,
    required: [true, 'Vegetarian status is required'],
    min: [0, 'Vegetarian must be 0 or 1'],
    max: [1, 'Vegetarian must be 0 or 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Vegetarian must be an integer'
    }
  },
  iron_food_freq: {
    type: Number,
    required: [true, 'Iron-rich food frequency is required'],
    min: [0, 'Iron-rich food frequency cannot be negative'],
    max: [3, 'Iron-rich food frequency must be between 0 and 3'],
    validate: {
      validator: Number.isInteger,
      message: 'Iron-rich food frequency must be an integer'
    }
  },
  dairy_freq: {
    type: Number,
    required: [true, 'Dairy frequency is required'],
    min: [0, 'Dairy frequency cannot be negative'],
    max: [3, 'Dairy frequency must be between 0 and 3'],
    validate: {
      validator: Number.isInteger,
      message: 'Dairy frequency must be an integer'
    }
  },
  sunlight_min: {
    type: Number,
    required: [true, 'Sunlight exposure is required'],
    min: [0, 'Sunlight exposure cannot be negative'],
    max: [65, 'Sunlight exposure must be between 0 and 65 minutes per day'],
    validate: {
      validator: Number.isInteger,
      message: 'Sunlight exposure must be an integer'
    }
  },
  junk_food_freq: {
    type: Number,
    required: [true, 'Junk food frequency is required'],
    min: [0, 'Junk food frequency cannot be negative'],
    max: [3, 'Junk food frequency must be between 0 and 3'],
    validate: {
      validator: Number.isInteger,
      message: 'Junk food frequency must be an integer'
    }
  },
  smoking: {
    type: Number,
    required: [true, 'Smoking status is required'],
    min: [0, 'Smoking must be 0 or 1'],
    max: [1, 'Smoking must be 0 or 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Smoking must be an integer'
    }
  },
  alcohol: {
    type: Number,
    required: [true, 'Alcohol consumption is required'],
    min: [0, 'Alcohol consumption cannot be negative'],
    max: [1, 'Alcohol must be 0 or 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Alcohol must be an integer'
    }
  },
  
  // Lab results
  hemoglobin: {
    type: Number,
    required: [true, 'Hemoglobin level is required'],
    min: [7.2, 'Hemoglobin level must be between 7.2 and 16.5'],
    max: [16.5, 'Hemoglobin level must be between 7.2 and 16.5'],
    validate: {
      validator: function(value) {
        if (!Number.isFinite(value)) return false;
        const decimalPart = value.toString().split('.')[1];
        return !decimalPart || decimalPart.length <= 2;
      },
      message: 'Hemoglobin level must be a valid number with at most 2 decimal places'
    }
  },
  ferritin: {
    type: Number,
    required: [true, 'Ferritin level is required'],
    min: [4.5, 'Ferritin level must be between 4.5 and 165'],
    max: [165, 'Ferritin level must be between 4.5 and 165'],
    validate: {
      validator: function(value) {
        if (!Number.isFinite(value)) return false;
        const decimalPart = value.toString().split('.')[1];
        return !decimalPart || decimalPart.length <= 2;
      },
      message: 'Ferritin level must be a valid number with at most 2 decimal places'
    }
  },
  vitamin_b12: {
    type: Number,
    required: [true, 'Vitamin B12 level is required'],
    min: [108, 'Vitamin B12 level must be between 108 and 550'],
    max: [550, 'Vitamin B12 level must be between 108 and 550'],
    validate: {
      validator: function(value) {
        if (!Number.isFinite(value)) return false;
        const decimalPart = value.toString().split('.')[1];
        return !decimalPart || decimalPart.length <= 2;
      },
      message: 'Vitamin B12 level must be a valid number with at most 2 decimal places'
    }
  },
  vitamin_d: {
    type: Number,
    required: [true, 'Vitamin D level is required'],
    min: [4.5, 'Vitamin D level must be between 4.5 and 49.5'],
    max: [49.5, 'Vitamin D level must be between 4.5 and 49.5'],
    validate: {
      validator: function(value) {
        if (!Number.isFinite(value)) return false;
        const decimalPart = value.toString().split('.')[1];
        return !decimalPart || decimalPart.length <= 2;
      },
      message: 'Vitamin D level must be a valid number with at most 2 decimal places'
    }
  },
  calcium: {
    type: Number,
    required: [true, 'Calcium level is required'],
    min: [6.75, 'Calcium level must be between 6.75 and 11.22'],
    max: [11.22, 'Calcium level must be between 6.75 and 11.22'],
    validate: {
      validator: function(value) {
        if (!Number.isFinite(value)) return false;
        const decimalPart = value.toString().split('.')[1];
        return !decimalPart || decimalPart.length <= 2;
      },
      message: 'Calcium level must be a valid number with at most 2 decimal places'
    }
  },
  
  // AI Analysis results
  aiAnalysis: {
    insights: {
      type: String,
      maxlength: [5000, 'AI insights cannot exceed 5000 characters']
    },
    recommendations: [{
      type: String,
      maxlength: [1000, 'Each recommendation cannot exceed 1000 characters']
    }],
    riskFactors: [{
      type: String,
      maxlength: [500, 'Each risk factor cannot exceed 500 characters']
    }],
    confidence: {
      type: Number,
      min: [0, 'Confidence must be between 0 and 1'],
      max: [1, 'Confidence must be between 0 and 1']
    },
    processedAt: {
      type: Date
    },
    modelVersion: {
      type: String,
      maxlength: [100, 'Model version cannot exceed 100 characters']
    }
  },

  // Optional model output columns (CSV col 19+)
  // Stored separately from aiAnalysis so the UI can render structured flags/scores.
  modelOutputs: {
    iron_def: { type: Number, min: 0, max: 1 },
    b12_def: { type: Number, min: 0, max: 1 },
    vitd_def: { type: Number, min: 0, max: 1 },
    calcium_def: { type: Number, min: 0, max: 1 },
    severity: { type: Number, min: 0, max: 100 },
    magnesium_def: { type: Number, min: 0, max: 1 },
    potassium_def: { type: Number, min: 0, max: 1 },
    protein_def: { type: Number, min: 0, max: 1 },
    zinc_def: { type: Number, min: 0, max: 1 },
    folate_def: { type: Number, min: 0, max: 1 },
    omega3_def: { type: Number, min: 0, max: 1 },
    electrolyte_imbalance: { type: Number, min: 0, max: 1 },
    general_malnutrition: { type: Number, min: 0, max: 1 },
    vitamin_b6_def: { type: Number, min: 0, max: 1 },
    copper_def: { type: Number, min: 0, max: 1 },
    selenium_def: { type: Number, min: 0, max: 1 },
    iodine_def: { type: Number, min: 0, max: 1 },
    vitamin_a_def: { type: Number, min: 0, max: 1 },
    choline_def: { type: Number, min: 0, max: 1 },
    gut_malabsorption: { type: Number, min: 0, max: 1 },
    chronic_inflammation: { type: Number, min: 0, max: 1 },
    chronic_dehydration: { type: Number, min: 0, max: 1 },
    protein_quality_def: { type: Number, min: 0, max: 1 }
  },

  // Optional model text outputs (from prediction2/prediction3)
  modelTextOutputs: {
    medicationBrandNames: { type: String, maxlength: [2000, 'Medication brand names cannot exceed 2000 characters'] },
    medicationText: { type: String, maxlength: [5000, 'Medication text cannot exceed 5000 characters'] },
    dietAdditions: { type: String, maxlength: [5000, 'Diet additions cannot exceed 5000 characters'] },
    nutrientRequirements: { type: String, maxlength: [2000, 'Nutrient requirements cannot exceed 2000 characters'] },
    vegetarianFoodMapping: { type: String, maxlength: [5000, 'Vegetarian food mapping cannot exceed 5000 characters'] },
    mandatoryDietChanges: { type: String, maxlength: [5000, 'Mandatory diet changes cannot exceed 5000 characters'] }
  },
  
  // Assessment metadata
  status: {
    type: String,
    enum: ['draft', 'completed', 'analyzed', 'archived'],
    default: 'draft'
  },
  completedAt: {
    type: Date
  },
  notes: {
    type: String,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance and queries
assessmentSchema.index({ userId: 1, createdAt: -1 });
assessmentSchema.index({ status: 1 });
assessmentSchema.index({ completedAt: -1 });
assessmentSchema.index({ 'aiAnalysis.processedAt': -1 });

// Pre-save middleware to encrypt sensitive data and set completedAt
assessmentSchema.pre('save', function(next) {
  // Encrypt sensitive lab results before saving
  if (this.isModified('hemoglobin') || this.isModified('ferritin') || 
      this.isModified('vitamin_b12') || this.isModified('vitamin_d') || 
      this.isModified('calcium')) {
    
    const sensitiveData = {
      hemoglobin: this.hemoglobin,
      ferritin: this.ferritin,
      vitamin_b12: this.vitamin_b12,
      vitamin_d: this.vitamin_d,
      calcium: this.calcium
    };
    
    const encryptedData = encryptHealthData(sensitiveData);
    
    this.hemoglobin = encryptedData.hemoglobin;
    this.ferritin = encryptedData.ferritin;
    this.vitamin_b12 = encryptedData.vitamin_b12;
    this.vitamin_d = encryptedData.vitamin_d;
    this.calcium = encryptedData.calcium;
  }

  // Set completedAt when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

// Post-find middleware to decrypt sensitive data
assessmentSchema.post(['find', 'findOne', 'findOneAndUpdate'], function(docs) {
  if (!docs) return;
  
  const decryptDoc = (doc) => {
    if (doc && typeof doc.toObject === 'function') {
      const sensitiveData = {
        hemoglobin: doc.hemoglobin,
        ferritin: doc.ferritin,
        vitamin_b12: doc.vitamin_b12,
        vitamin_d: doc.vitamin_d,
        calcium: doc.calcium
      };
      
      const decryptedData = decryptHealthData(sensitiveData);
      
      doc.hemoglobin = decryptedData.hemoglobin;
      doc.ferritin = decryptedData.ferritin;
      doc.vitamin_b12 = decryptedData.vitamin_b12;
      doc.vitamin_d = decryptedData.vitamin_d;
      doc.calcium = decryptedData.calcium;
    }
  };

  if (Array.isArray(docs)) {
    docs.forEach(decryptDoc);
  } else {
    decryptDoc(docs);
  }
});

// Instance method to check if assessment is complete
assessmentSchema.methods.isComplete = function() {
  const requiredFields = [
    'fatigue', 'hair_loss', 'acidity', 'dizziness', 'muscle_pain', 'numbness',
    'vegetarian', 'iron_food_freq', 'dairy_freq', 'sunlight_min', 'junk_food_freq', 'smoking', 'alcohol',
    'hemoglobin', 'ferritin', 'vitamin_b12', 'vitamin_d', 'calcium'
  ];
  
  return requiredFields.every(field => this[field] !== undefined && this[field] !== null);
};

// Instance method to get symptom summary
assessmentSchema.methods.getSymptomSummary = function() {
  return {
    fatigue: this.fatigue,
    hair_loss: this.hair_loss,
    acidity: this.acidity,
    dizziness: this.dizziness,
    muscle_pain: this.muscle_pain,
    numbness: this.numbness
  };
};

// Instance method to get lifestyle summary
assessmentSchema.methods.getLifestyleSummary = function() {
  return {
    vegetarian: this.vegetarian,
    iron_food_freq: this.iron_food_freq,
    dairy_freq: this.dairy_freq,
    sunlight_min: this.sunlight_min,
    junk_food_freq: this.junk_food_freq,
    smoking: this.smoking,
    alcohol: this.alcohol
  };
};

// Instance method to get lab results summary
assessmentSchema.methods.getLabResultsSummary = function() {
  return {
    hemoglobin: this.hemoglobin,
    ferritin: this.ferritin,
    vitamin_b12: this.vitamin_b12,
    vitamin_d: this.vitamin_d,
    calcium: this.calcium
  };
};

// Static method to find assessments by user
assessmentSchema.statics.findByUser = function(userId, options = {}) {
  const query = this.find({ userId });
  
  if (options.status) {
    query.where('status').equals(options.status);
  }
  
  if (options.limit) {
    query.limit(options.limit);
  }
  
  return query.sort({ createdAt: -1 });
};

// Static method to find completed assessments
assessmentSchema.statics.findCompleted = function(userId) {
  return this.find({ 
    userId, 
    status: { $in: ['completed', 'analyzed'] } 
  }).sort({ completedAt: -1 });
};

// Virtual for assessment age in days
assessmentSchema.virtual('ageInDays').get(function() {
  if (!this.createdAt) return null;
  
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

const Assessment = mongoose.model('Assessment', assessmentSchema);

export default Assessment;