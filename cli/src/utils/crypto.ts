/**
 * crypto.ts — AES-256-GCM End-to-End Encryption Utility
 *
 * Security model:
 *  ┌────────────────────────────────────────────────────────────────┐
 *  │  What the SERVER sees:  { iv, authTag, ciphertext }  ← opaque │
 *  │  What stays LOCAL:      localKeyHex               ← never sent│
 *  └────────────────────────────────────────────────────────────────┘
 *
 *  The 256-bit symmetric key is generated fresh for every push.
 *  It is returned to the caller as a hex string and appended to the
 *  server's phrase out-of-band: `word-word-word#<localKeyHex>`
 *
 *  AES-256-GCM provides:
 *   - Confidentiality (AES-CTR underlying mode)
 *   - Integrity + Authenticity (128-bit GHASH auth tag)
 *
 *  The auth tag makes it impossible to tamper with the ciphertext or
 *  IV without causing decryption to throw — there is no "decrypt and
 *  hope for the best" failure mode.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm" as const;
const KEY_BYTES = 32; // 256 bits
const IV_BYTES = 12;  // 96 bits — GCM standard recommended length
const TAG_BYTES = 16; // 128-bit auth tag (GCM maximum, most secure)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The encrypted bundle that travels to (and is stored by) the relay server.
 * Every field is a lowercase hex string. The server treats these as opaque.
 */
export interface ServerPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
}

/**
 * Result of a successful `encryptEnv` call.
 */
export interface EncryptResult {
  /**
   * The 32-byte AES key encoded as a 64-character hex string.
   * NEVER sent to the server — appended to the share code by the caller.
   */
  localKeyHex: string;

  /**
   * The opaque encrypted bundle safe to hand off to the relay server.
   */
  serverPayload: ServerPayload;
}

// ---------------------------------------------------------------------------
// encryptEnv
// ---------------------------------------------------------------------------

/**
 * Encrypts a plaintext `.env` string using AES-256-GCM.
 *
 * A fresh cryptographically random key and IV are generated for every call,
 * so even encrypting the same plaintext twice produces completely different
 * ciphertexts.
 *
 * @param plaintext  The raw contents of the .env file (UTF-8).
 * @returns          An `EncryptResult` containing the local-only key and
 *                   the server-safe payload.
 */
export function encryptEnv(plaintext: string): EncryptResult {
  // Generate fresh key + IV for this session — never reuse either
  const key = randomBytes(KEY_BYTES);
  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_BYTES,
  });

  // Encrypt the plaintext. GCM can do it in one shot for our payload sizes.
  const ciphertextBuf = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  // The auth tag is only available AFTER cipher.final()
  const authTagBuf = cipher.getAuthTag();

  return {
    localKeyHex: key.toString("hex"),
    serverPayload: {
      iv: iv.toString("hex"),
      authTag: authTagBuf.toString("hex"),
      ciphertext: ciphertextBuf.toString("hex"),
    },
  };
}

// ---------------------------------------------------------------------------
// decryptEnv
// ---------------------------------------------------------------------------

/**
 * Decrypts an AES-256-GCM encrypted payload retrieved from the relay server.
 *
 * The GHASH auth tag is verified automatically by Node's `createDecipheriv`
 * when `decipher.final()` is called. If verification fails — either because
 * the ciphertext was tampered with, the key is wrong, or the IV/tag was
 * corrupted — Node throws internally and we surface a clear, actionable error.
 *
 * @param serverPayload  The `{ iv, authTag, ciphertext }` object from the server.
 * @param localKeyHex    The 64-character hex key from the share code.
 * @returns              The original plaintext `.env` string.
 * @throws               If auth tag verification fails (tamper or wrong key).
 */
export function decryptEnv(
  serverPayload: ServerPayload,
  localKeyHex: string
): string {
  // -- Reconstruct Buffers from hex ------------------------------------------
  let key: Buffer;
  let iv: Buffer;
  let authTag: Buffer;
  let ciphertext: Buffer;

  try {
    key = Buffer.from(localKeyHex, "hex");
    iv = Buffer.from(serverPayload.iv, "hex");
    authTag = Buffer.from(serverPayload.authTag, "hex");
    ciphertext = Buffer.from(serverPayload.ciphertext, "hex");
  } catch {
    throw new Error(
      "Decryption failed: could not decode hex fields from server payload."
    );
  }

  // -- Validate key length (must be exactly 32 bytes for AES-256) ------------
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `Decryption failed: invalid key length (got ${key.length} bytes, expected ${KEY_BYTES}).`
    );
  }

  // -- Validate IV length (must be exactly 12 bytes for GCM) -----------------
  if (iv.length !== IV_BYTES) {
    throw new Error(
      `Decryption failed: invalid IV length (got ${iv.length} bytes, expected ${IV_BYTES}).`
    );
  }

  // -- Decrypt ---------------------------------------------------------------
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_BYTES,
  });

  // setAuthTag must be called BEFORE any update/final calls
  decipher.setAuthTag(authTag);

  let plaintext: string;

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(), // ← GCM auth tag is verified here; throws on failure
    ]);
    plaintext = decrypted.toString("utf8");
  } catch (err) {
    // Node throws a generic "Unsupported state or unable to authenticate data"
    // error on auth tag failure — replace it with a clear user-facing message.
    throw new Error(
      "Decryption failed: payload tampered with or invalid key. " +
        "Ensure you copied the full share code without modification."
    );
  }

  return plaintext;
}
