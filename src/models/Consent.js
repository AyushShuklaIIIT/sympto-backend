import mongoose from 'mongoose';

const consentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true
  },
  
  // Essential consent (always required)
  essential: {
    type: Boolean,
    default: true,
    required: true
  },
  
  // Analytics and service improvement
  analytics: {
    type: Boolean,
    default: true
  },
  
  // Marketing communications
  communications: {
    type: Boolean,
    default: false
  },
  
  // Research and development (anonymized data)
  research: {
    type: Boolean,
    default: false
  },
  
  // Consent history for audit trail
  consentHistory: [{
    consentType: {
      type: String,
      enum: ['analytics', 'communications', 'research'],
      required: true
    },
    granted: {
      type: Boolean,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    }
  }],
  
  // GDPR compliance fields
  gdprCompliant: {
    type: Boolean,
    default: true
  },
  
  // Last consent update
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  // Consent version (for tracking policy changes)
  consentVersion: {
    type: String,
    default: '1.0'
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

// Indexes for performance (userId index is created automatically by unique: true)
consentSchema.index({ lastUpdated: -1 });
consentSchema.index({ 'consentHistory.timestamp': -1 });

// Pre-save middleware to update lastUpdated
consentSchema.pre('save', function(next) {
  if (this.isModified('analytics') || this.isModified('communications') || this.isModified('research')) {
    this.lastUpdated = new Date();
  }
  next();
});

// Instance method to record consent change
consentSchema.methods.recordConsentChange = function(consentType, granted, ipAddress, userAgent) {
  this.consentHistory.push({
    consentType,
    granted,
    timestamp: new Date(),
    ipAddress,
    userAgent
  });
  
  // Keep only last 50 consent changes to prevent unlimited growth
  if (this.consentHistory.length > 50) {
    this.consentHistory = this.consentHistory.slice(-50);
  }
};

// Instance method to get current consent status
consentSchema.methods.getCurrentConsent = function() {
  return {
    essential: this.essential,
    analytics: this.analytics,
    communications: this.communications,
    research: this.research,
    lastUpdated: this.lastUpdated,
    consentVersion: this.consentVersion
  };
};

// Static method to find or create consent for user
consentSchema.statics.findOrCreateForUser = async function(userId) {
  let consent = await this.findOne({ userId });
  
  if (!consent) {
    consent = new this({
      userId,
      essential: true,
      analytics: true,
      communications: false,
      research: false
    });
    await consent.save();
  }
  
  return consent;
};

// Static method to update consent preferences
consentSchema.statics.updateConsent = async function(userId, preferences, ipAddress, userAgent) {
  const consent = await this.findOrCreateForUser(userId);
  
  // Record changes in history
  Object.keys(preferences).forEach(key => {
    if (key !== 'essential' && consent[key] !== preferences[key]) {
      consent.recordConsentChange(key, preferences[key], ipAddress, userAgent);
    }
  });
  
  // Update preferences (essential cannot be changed)
  if (preferences.analytics !== undefined) consent.analytics = preferences.analytics;
  if (preferences.communications !== undefined) consent.communications = preferences.communications;
  if (preferences.research !== undefined) consent.research = preferences.research;
  
  await consent.save();
  return consent;
};

const Consent = mongoose.model('Consent', consentSchema);

export default Consent;