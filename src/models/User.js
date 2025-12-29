import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { encryptData, decryptData, isEncryptedValue } from '../utils/encryption.js';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    validate: {
      validator: function(value) {
        if (value === undefined || value === null) return true;
        if (typeof value !== 'string') return false;
        // Allow ciphertext to be stored; enforce max length on plaintext.
        if (isEncryptedValue(value)) return true;
        return value.trim().length <= 50;
      },
      message: 'First name cannot exceed 50 characters'
    }
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    validate: {
      validator: function(value) {
        if (value === undefined || value === null) return true;
        if (typeof value !== 'string') return false;
        // Allow ciphertext to be stored; enforce max length on plaintext.
        if (isEncryptedValue(value)) return true;
        return value.trim().length <= 50;
      },
      message: 'Last name cannot exceed 50 characters'
    }
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(value) {
        // Must be at least 13 years old and not in the future
        const today = new Date();
        const minAge = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
        return value <= minAge && value >= new Date('1900-01-01');
      },
      message: 'Date of birth must be valid and user must be at least 13 years old'
    }
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.emailVerificationToken;
      delete ret.emailVerificationExpires;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance (email index is created automatically by unique: true)
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });
userSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password and encrypt sensitive data
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (this.isModified('password')) {
    try {
      // Hash password with cost of 12
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }

  // Encrypt sensitive personal data
  if (this.isModified('firstName')) {
    this.firstName = encryptData(this.firstName);
  }
  if (this.isModified('lastName')) {
    this.lastName = encryptData(this.lastName);
  }
  if (this.isModified('dateOfBirth') && this.dateOfBirth) {
    this.dateOfBirth = encryptData(this.dateOfBirth.toISOString());
  }

  next();
});

// Post-find middleware to decrypt sensitive data
userSchema.post(['find', 'findOne', 'findOneAndUpdate'], function(docs) {
  if (!docs) return;
  
  const decryptDoc = (doc) => {
    if (doc && typeof doc.toObject === 'function') {
      try {
        if (doc.firstName) {
          doc.firstName = decryptData(doc.firstName);
        }
        if (doc.lastName) {
          doc.lastName = decryptData(doc.lastName);
        }
        if (doc.dateOfBirth && typeof doc.dateOfBirth === 'string') {
          const decryptedDate = decryptData(doc.dateOfBirth);
          doc.dateOfBirth = new Date(decryptedDate);
        }
      } catch (error) {
        console.error('Error decrypting user data:', error);
        // Continue with encrypted data if decryption fails
      }
    }
  };

  if (Array.isArray(docs)) {
    docs.forEach(decryptDoc);
  } else {
    decryptDoc(docs);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Instance method to get full name
userSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Virtual for user age
userSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

const User = mongoose.model('User', userSchema);

export default User;