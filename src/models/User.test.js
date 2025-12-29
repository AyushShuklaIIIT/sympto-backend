import User from './User.js';

const makeCiphertextLikeValue = (cipherHexLength = 120) => {
  const ivHex = 'a'.repeat(24); // 12 bytes
  const authTagHex = 'b'.repeat(32); // 16 bytes
  const cipherHex = 'c'.repeat(cipherHexLength);
  return `${ivHex}:${authTagHex}:${cipherHex}`;
};

describe('User model encryption/validation compatibility', () => {
  test('allows ciphertext-shaped firstName/lastName to pass validation', async () => {
    const user = new User({
      email: 'ciphertext-ok@example.com',
      password: 'Password123',
      firstName: makeCiphertextLikeValue(200),
      lastName: makeCiphertextLikeValue(220)
    });

    await expect(user.validate()).resolves.toBeUndefined();
  });

  test('rejects plaintext names longer than 50 chars', async () => {
    const user = new User({
      email: 'plaintext-too-long@example.com',
      password: 'Password123',
      firstName: 'x'.repeat(51),
      lastName: 'y'.repeat(51)
    });

    await expect(user.validate()).rejects.toThrow(/cannot exceed 50 characters/i);
  });

  test('login-like save (update lastLogin) does not fail even when decrypt cannot authenticate', async () => {
    const email = 'legacy-encrypted@example.com';

    // Save a user where first/last names look encrypted but are not decryptable with the current key.
    await User.create({
      email,
      password: 'Password123',
      firstName: makeCiphertextLikeValue(160),
      lastName: makeCiphertextLikeValue(160)
    });

    const user = await User.findOne({ email }).select('+password');
    expect(user).toBeTruthy();

    // This mimics `/login` and `/forgot-password` which set a field then call `save()`.
    user.lastLogin = new Date();
    await expect(user.save()).resolves.toBeDefined();
  });

  test('allows saving a user with dateOfBirth (stored as Date)', async () => {
    const email = `dob-${Date.now()}@example.com`;
    const user = new User({
      email,
      password: 'Abcd1234',
      firstName: 'Test',
      lastName: 'User',
      dateOfBirth: new Date('2000-01-01'),
    });

    await expect(user.save()).resolves.toBeDefined();
    expect(user.dateOfBirth instanceof Date).toBe(true);
    expect(typeof user.age === 'number' || user.age === null).toBe(true);
  });
});
