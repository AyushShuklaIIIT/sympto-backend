#!/usr/bin/env node

/**
 * Generate secure keys for development environment
 */

import { generateSecureKeys } from '../src/utils/securityConfig.js';
import fs from 'node:fs';
import path from 'node:path';

const generateDevKeys = () => {
  console.log('🔑 Generating secure keys for development...\n');
  
  const keys = generateSecureKeys();
  
  console.log('Add these to your .env file:\n');
  console.log(`ENCRYPTION_KEY=${keys.encryptionKey}`);
  console.log(`JWT_SECRET=${keys.jwtSecret}`);
  console.log(`JWT_REFRESH_SECRET=${keys.jwtRefreshSecret}`);
  console.log(`SESSION_SECRET=${keys.sessionSecret}`);
  
  // Optionally write to .env.local file
  const envLocalPath = path.join(process.cwd(), '.env.local');
  const envContent = `# Generated secure keys for development
ENCRYPTION_KEY=${keys.encryptionKey}
JWT_SECRET=${keys.jwtSecret}
JWT_REFRESH_SECRET=${keys.jwtRefreshSecret}
SESSION_SECRET=${keys.sessionSecret}
`;

  try {
    fs.writeFileSync(envLocalPath, envContent);
    console.log(`\n✅ Keys saved to .env.local`);
    console.log('⚠️  Make sure to add .env.local to your .gitignore file');
  } catch (error) {
    console.log(`\n⚠️  Could not write to .env.local: ${error.message}`);
    console.log('Please copy the keys above to your .env file manually');
  }
  
  console.log('\n🔒 Keep these keys secure and never commit them to version control!');
};

generateDevKeys();