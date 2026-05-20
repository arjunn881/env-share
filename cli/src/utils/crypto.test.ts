/**
 * crypto.test.ts — Self-contained round-trip tests for encryptEnv / decryptEnv
 *
 * Run with: npx tsx src/utils/crypto.test.ts
 *
 * Tests:
 *  1. Round-trip: encrypt -> decrypt produces original plaintext
 *  2. Uniqueness: two encryptions of same plaintext produce different ciphertexts
 *  3. Tamper detection: modifying ciphertext causes decryption to throw
 *  4. Wrong key: using incorrect key throws with clear message
 *  5. Bad hex: malformed hex in key throws gracefully
 *  6. Key length guard: wrong-length key hex throws before any crypto call
 */

import { encryptEnv, decryptEnv } from "./crypto.js";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✅ PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL  ${name}`);
    console.error(`         ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn: () => unknown, expectedFragment: string): void {
  try {
    fn();
    throw new Error(`Expected an error containing "${expectedFragment}" but nothing was thrown`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes(expectedFragment)) {
      throw new Error(`Error message "${msg}" does not contain expected "${expectedFragment}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const SAMPLE_ENV = [
  "PORT=3000",
  "DATABASE_URL=postgres://user:hunter2@localhost:5432/mydb",
  "SECRET_KEY=super-secret-value-123!@#",
  "FEATURE_FLAG=true",
  "EMPTY_VALUE=",
  "# This is a comment",
  "UNICODE_VAL=héllo wörld 🔐",
].join("\n");

console.log("\n🔐 env-share — AES-256-GCM Crypto Test Suite\n");

// Test 1: Basic round-trip
test("Round-trip: encrypt then decrypt produces original plaintext", () => {
  const { localKeyHex, serverPayload } = encryptEnv(SAMPLE_ENV);
  const decrypted = decryptEnv(serverPayload, localKeyHex);
  assertEqual(decrypted, SAMPLE_ENV, "plaintext");
});

// Test 2: Each encryption produces unique ciphertext (fresh IV each time)
test("Uniqueness: same plaintext encrypted twice gives different ciphertext+IV", () => {
  const result1 = encryptEnv(SAMPLE_ENV);
  const result2 = encryptEnv(SAMPLE_ENV);

  if (result1.serverPayload.ciphertext === result2.serverPayload.ciphertext) {
    throw new Error("Ciphertexts are identical — IV is being reused!");
  }
  if (result1.serverPayload.iv === result2.serverPayload.iv) {
    throw new Error("IVs are identical — randomBytes is not working!");
  }
  if (result1.localKeyHex === result2.localKeyHex) {
    throw new Error("Keys are identical — fresh key generation is broken!");
  }
});

// Test 3: Output format — hex strings of expected lengths
test("Output: localKeyHex is 64 hex chars (32 bytes), IV is 24, authTag is 32", () => {
  const { localKeyHex, serverPayload } = encryptEnv("PORT=3000");

  assertEqual(localKeyHex.length, 64, "key hex length (64 chars = 32 bytes)");
  assertEqual(serverPayload.iv.length, 24, "IV hex length (24 chars = 12 bytes)");
  assertEqual(serverPayload.authTag.length, 32, "authTag hex length (32 chars = 16 bytes)");

  // All must be valid hex strings
  if (!/^[0-9a-f]+$/i.test(localKeyHex)) throw new Error("localKeyHex is not valid hex");
  if (!/^[0-9a-f]+$/i.test(serverPayload.iv)) throw new Error("IV is not valid hex");
  if (!/^[0-9a-f]+$/i.test(serverPayload.authTag)) throw new Error("authTag is not valid hex");
  if (!/^[0-9a-f]+$/i.test(serverPayload.ciphertext)) throw new Error("ciphertext is not valid hex");
});

// Test 4: Tamper detection — flip one byte in ciphertext
test("Tamper: modified ciphertext fails auth tag verification", () => {
  const { localKeyHex, serverPayload } = encryptEnv(SAMPLE_ENV);

  // Flip the first byte of the ciphertext hex
  const tamperedHex =
    ((parseInt(serverPayload.ciphertext.slice(0, 2), 16) ^ 0xff)
      .toString(16)
      .padStart(2, "0")) + serverPayload.ciphertext.slice(2);

  assertThrows(
    () => decryptEnv({ ...serverPayload, ciphertext: tamperedHex }, localKeyHex),
    "Decryption failed"
  );
});

// Test 5: Tamper detection — flip one byte in the auth tag itself
test("Tamper: modified authTag fails verification", () => {
  const { localKeyHex, serverPayload } = encryptEnv(SAMPLE_ENV);

  const tamperedTag =
    ((parseInt(serverPayload.authTag.slice(0, 2), 16) ^ 0xff)
      .toString(16)
      .padStart(2, "0")) + serverPayload.authTag.slice(2);

  assertThrows(
    () => decryptEnv({ ...serverPayload, authTag: tamperedTag }, localKeyHex),
    "Decryption failed"
  );
});

// Test 6: Wrong key
test("Wrong key: decryption with different key throws", () => {
  const { serverPayload } = encryptEnv(SAMPLE_ENV);
  const wrongKey = encryptEnv("dummy").localKeyHex; // fresh random key

  assertThrows(
    () => decryptEnv(serverPayload, wrongKey),
    "Decryption failed"
  );
});

// Test 7: Key length guard (too short)
test("Key length guard: 30-byte key hex throws before crypto call", () => {
  const { serverPayload } = encryptEnv(SAMPLE_ENV);
  const shortKey = "aa".repeat(30); // 30 bytes = 60 hex chars (not 64)

  assertThrows(
    () => decryptEnv(serverPayload, shortKey),
    "invalid key length"
  );
});

// Test 8: Empty plaintext round-trip
test("Edge case: empty string round-trips correctly", () => {
  const { localKeyHex, serverPayload } = encryptEnv("");
  const decrypted = decryptEnv(serverPayload, localKeyHex);
  assertEqual(decrypted, "", "empty plaintext");
});

// Test 9: Large payload (simulate a real-world heavy .env)
test("Edge case: 50KB plaintext round-trips correctly", () => {
  const bigEnv = Array.from({ length: 1000 }, (_, i) => `KEY_${i}=${"x".repeat(40)}`).join("\n");
  const { localKeyHex, serverPayload } = encryptEnv(bigEnv);
  const decrypted = decryptEnv(serverPayload, localKeyHex);
  assertEqual(decrypted, bigEnv, "large payload");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"─".repeat(50)}`);
console.log(`  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total`);
console.log(`${"─".repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
}
