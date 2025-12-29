#!/usr/bin/env node

/**
 * Scan users for encrypted-looking fields that cannot be decrypted with the current ENCRYPTION_KEY.
 *
 * Usage:
 *   node scripts/scanUndecryptableUsers.js
 *   node scripts/scanUndecryptableUsers.js --delete
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import { isEncryptedValue, tryDecryptData } from '../src/utils/encryption.js';

dotenv.config();

const shouldDelete = process.argv.includes('--delete');

const main = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  if (!process.env.ENCRYPTION_KEY) {
    console.error('ENCRYPTION_KEY is not set. Refusing to scan.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  let scanned = 0;
  let flagged = 0;
  let deleted = 0;

  const cursor = User.find(
    {},
    { email: 1, firstName: 1, lastName: 1 }
  )
    .lean()
    .cursor();

  for await (const user of cursor) {
    scanned++;

    const issues = [];

    for (const field of ['firstName', 'lastName']) {
      const value = user[field];
      if (!value || typeof value !== 'string') continue;
      if (!isEncryptedValue(value)) continue;

      const attempt = tryDecryptData(value);
      if (!attempt.ok) {
        issues.push(field);
      }
    }

    if (issues.length === 0) continue;

    flagged++;
    console.log(
      `[FLAG] ${user.email} (${user._id}) undecryptable: ${issues.join(', ')}`
    );

    if (shouldDelete) {
      await User.deleteOne({ _id: user._id });
      deleted++;
      console.log(`  -> deleted`);
    }
  }

  console.log('\nSummary');
  console.log(`- Scanned: ${scanned}`);
  console.log(`- Flagged: ${flagged}`);
  if (shouldDelete) console.log(`- Deleted: ${deleted}`);

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
