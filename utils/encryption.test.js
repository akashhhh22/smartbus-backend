require('dotenv').config();
const assert = require('assert');
const { encryptData, decryptData } = require('./encryption');

// Test suite for decryptData function
console.log('Running decryptData tests...\n');

// Test 1.1: Test with null input
console.log('Test 1.1: decryptData(null) should return null');
try {
  const result = decryptData(null);
  assert.strictEqual(result, null, 'Expected null for null input');
  console.log('✓ PASS: Returns null for null input\n');
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
  process.exit(1);
}

// Test 1.2: Test with invalid cipher text
console.log('Test 1.2: decryptData(invalidCipher) should return original value');
try {
  const invalidCipher = 'this-is-not-encrypted-data';
  const result = decryptData(invalidCipher);
  assert.strictEqual(result, invalidCipher, 'Expected original value for invalid cipher');
  console.log('✓ PASS: Returns original value for invalid cipher\n');
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
  process.exit(1);
}

// Test 1.3: Test with valid encrypted data
console.log('Test 1.3: decryptData(validCipher) should return decrypted text');
try {
  const originalText = 'test@example.com';
  const encrypted = encryptData(originalText);
  const decrypted = decryptData(encrypted);
  assert.strictEqual(decrypted, originalText, 'Expected decrypted text to match original');
  console.log('✓ PASS: Returns decrypted text for valid cipher\n');
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
  process.exit(1);
}

// Test 1.4: Test with plaintext string
console.log('Test 1.4: decryptData(plaintext) should return original plaintext');
try {
  const plaintext = 'plaintext@example.com';
  const result = decryptData(plaintext);
  assert.strictEqual(result, plaintext, 'Expected original plaintext value');
  console.log('✓ PASS: Returns original value for plaintext\n');
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
  process.exit(1);
}

// Test 1.5: Verify no exceptions thrown
console.log('Test 1.5: Verify no exceptions thrown for various inputs');
try {
  const testInputs = [
    null,
    undefined,
    '',
    'random-string',
    'U2FsdGVkX1+invalid',
    '12345',
    'special!@#$%^&*()chars'
  ];
  
  testInputs.forEach(input => {
    try {
      decryptData(input);
    } catch (error) {
      throw new Error(`Exception thrown for input: ${input}`);
    }
  });
  
  console.log('✓ PASS: No exceptions thrown for any input\n');
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
  process.exit(1);
}

console.log('All tests passed! ✓');
