import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

// Encryption configuration
// NOTE: ENCRYPTION_KEY must be stable across restarts, otherwise previously-encrypted
// data becomes undecryptable. Security config validation also enforces presence.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

let hasLoggedDecryptFailure = false;

/**
 * Detect whether a value looks like our `iv:authTag:ciphertext` payload.
 * @param {string} value
 * @returns {boolean}
 */
export const isEncryptedValue = (value) => {
  if (!value || typeof value !== 'string') return false;

  const parts = value.split(':');
  if (parts.length !== 3) return false;

  const [ivHex, authTagHex, cipherHex] = parts;

  // 12-byte IV => 24 hex chars; 16-byte auth tag => 32 hex chars
  if (ivHex.length !== 24 || authTagHex.length !== 32) return false;
  if (!ivHex || !authTagHex || !cipherHex) return false;

  const isHex = (str) => /^[0-9a-f]+$/i.test(str);
  return isHex(ivHex) && isHex(authTagHex) && isHex(cipherHex);
};

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param {string} text - Text to encrypt
 * @returns {string} Encrypted text with IV and auth tag
 */
export const encryptData = (text) => {
  if (!text || typeof text !== 'string') {
    return text;
  }

  try {
    const iv = randomBytes(12); // AES-256-GCM uses 12 bytes IV
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex'); // Ensure 32 bytes key
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV, auth tag, and encrypted data
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt sensitive data using AES-256-GCM
 * @param {string} encryptedText - Encrypted text with IV and auth tag
 * @returns {string} Decrypted text
 */
export const decryptData = (encryptedText) => {
  if (!encryptedText || typeof encryptedText !== 'string') {
    return encryptedText;
  }

  try {
    if (!isEncryptedValue(encryptedText)) {
      // If not in expected format, assume it's not encrypted
      return encryptedText;
    }

    const parts = encryptedText.split(':');

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex'); // Ensure 32 bytes key
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    if (!hasLoggedDecryptFailure) {
      hasLoggedDecryptFailure = true;
      console.warn(
        'Decryption failed for stored data. This usually means ENCRYPTION_KEY changed between runs or the database contains legacy/corrupted ciphertext. Returning ciphertext as-is.'
      );
    }
    // Return original text if decryption fails (key mismatch / corrupted / legacy)
    return encryptedText;
  }
};

/**
 * Attempt to decrypt and report whether it succeeded.
 * Useful for maintenance scripts where you need to distinguish "ciphertext" from
 * "successfully decrypted plaintext".
 *
 * @param {string} encryptedText
 * @returns {{ ok: true, value: string } | { ok: false, value: string, error: Error }}
 */
export const tryDecryptData = (encryptedText) => {
  if (!encryptedText || typeof encryptedText !== 'string') {
    return { ok: true, value: encryptedText };
  }

  if (!isEncryptedValue(encryptedText)) {
    return { ok: true, value: encryptedText };
  }

  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return { ok: true, value: decrypted };
  } catch (error) {
    return { ok: false, value: encryptedText, error };
  }
};

/**
 * Hash sensitive data for comparison (one-way)
 * @param {string} data - Data to hash
 * @returns {string} Hashed data
 */
export const hashData = (data) => {
  if (!data || typeof data !== 'string') {
    return data;
  }

  return createHash('sha256').update(data).digest('hex');
};

/**
 * Generate secure random string
 * @param {number} length - Length of random string
 * @returns {string} Random string
 */
export const generateSecureRandom = (length = 32) => {
  return randomBytes(length).toString('hex');
};

/**
 * Encrypt health data fields that contain sensitive information
 * @param {Object} data - Assessment data object
 * @returns {Object} Data with encrypted sensitive fields
 */
export const encryptHealthData = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'hemoglobin', 'ferritin', 'vitamin_b12', 'vitamin_d', 'calcium'
  ];

  const encryptedData = { ...data };

  sensitiveFields.forEach(field => {
    if (encryptedData[field] !== undefined && encryptedData[field] !== null) {
      // Convert to string and encrypt
      encryptedData[field] = encryptData(encryptedData[field].toString());
    }
  });

  return encryptedData;
};

/**
 * Decrypt health data fields that contain sensitive information
 * @param {Object} data - Assessment data object with encrypted fields
 * @returns {Object} Data with decrypted sensitive fields
 */
export const decryptHealthData = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'hemoglobin', 'ferritin', 'vitamin_b12', 'vitamin_d', 'calcium'
  ];

  const decryptedData = { ...data };

  sensitiveFields.forEach(field => {
    if (decryptedData[field] !== undefined && decryptedData[field] !== null) {
      try {
        const decrypted = decryptData(decryptedData[field]);
        // Convert back to number if it was originally a number
        const numValue = Number.parseFloat(decrypted);
        decryptedData[field] = Number.isNaN(numValue) ? decrypted : numValue;
      } catch (error) {
        console.error(`Failed to decrypt field ${field}:`, error);
        // Keep original value if decryption fails
      }
    }
  });

  return decryptedData;
};

/**
 * Validate encryption key strength
 * @returns {boolean} True if encryption key is strong enough
 */
export const validateEncryptionKey = () => {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    console.warn('Encryption key is too short. Use at least 32 characters.');
    return false;
  }
  return true;
};

// Initialize encryption validation
if (process.env.NODE_ENV === 'production' && !validateEncryptionKey()) {
  throw new Error('Invalid encryption key configuration for production environment');
}