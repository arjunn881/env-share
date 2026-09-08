---
layout: ../../layouts/BlogPost.astro
title: "AES-256-GCM Explained for Developers"
description: "A developer-friendly breakdown of AES-256-GCM encryption: keys, IVs, authentication tags, and why it is the right choice for encrypting .env files."
date: "2024-12-08"
readTime: "5 min read"
tags: ["Cryptography", "Security", "Node.js"]
---

If you have read the share-env documentation, you have seen "AES-256-GCM" mentioned as the encryption algorithm. But what does that actually mean? And why does it matter for securing your `.env` files?

This is a developer-focused breakdown — no mathematics degree required.

---

## What Is AES?

**AES** stands for Advanced Encryption Standard. It is a symmetric encryption algorithm, meaning the same key is used to both encrypt and decrypt data. It was established by NIST in 2001 and is the encryption standard used by governments, banks, and virtually every secure system on the planet.

"Symmetric" means both parties — the sender and receiver — need the same key. This is in contrast to RSA, which uses a public key to encrypt and a private key to decrypt.

---

## What Does 256 Mean?

The `256` in AES-256 refers to the key length: 256 bits, or 32 bytes.

AES supports three key sizes: 128, 192, and 256 bits. The longer the key, the harder it is to brute-force.

To brute-force a 256-bit key, you would need to try 2^256 combinations. That is approximately 1.15 × 10^77 attempts. At a trillion guesses per second, it would take longer than the current age of the universe — many times over. AES-256 is considered quantum-resistant for the foreseeable future.

---

## What Is GCM?

**GCM** stands for **Galois/Counter Mode**. It is a _mode of operation_ for block ciphers like AES.

AES itself only encrypts a single fixed-size block (128 bits). To encrypt larger data, you need a mode that applies AES repeatedly. GCM is one of those modes.

But GCM does more than just encryption. It provides **authenticated encryption**, which means it also verifies that the ciphertext has not been tampered with. Here's how:

### The Authentication Tag

When you encrypt with AES-256-GCM, you get three outputs:
1. **Ciphertext** — the encrypted data
2. **IV (Initialization Vector)** — a random nonce used during encryption
3. **Auth tag** — a 128-bit MAC (Message Authentication Code)

When you decrypt, you supply all three. The decryptor recomputes the auth tag and compares it to the stored one. If they do not match — even by one bit — decryption fails immediately.

This means:
- If anyone modifies the ciphertext in transit, decryption rejects it
- If the key is wrong, decryption rejects it
- There is no way to manipulate the ciphertext and produce valid plaintext

---

## Why Is an IV (Initialization Vector) Needed?

Without an IV, encrypting the same plaintext with the same key always produces the same ciphertext. This leaks information — an attacker can tell when the same data has been sent twice.

The IV (also called a nonce) is a random value mixed into the encryption process. Even if you encrypt identical `.env` files, the ciphertext is always unique because the IV is different.

**Key rule:** The IV must be random and must never be reused with the same key.

In share-env, the IV is generated with `crypto.randomBytes(12)` — 12 bytes, which is the NIST-recommended size for GCM. It is stored alongside the ciphertext (it is not a secret) and used at decryption time.

---

## How share-env Uses AES-256-GCM

Here is the exact sequence:

```javascript
// Simplified version of share-env's encryption
const crypto = require('crypto');

// 1. Generate a random 256-bit key (stays local, goes into share code)
const key = crypto.randomBytes(32);

// 2. Generate a random 96-bit IV (sent with ciphertext, not a secret)
const iv = crypto.randomBytes(12);

// 3. Encrypt with AES-256-GCM
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

// 4. Get the authentication tag
const authTag = cipher.getAuthTag(); // 16 bytes (128 bits)

// What gets sent to the relay: { ciphertext, iv, authTag }
// What stays local: key
```

And decryption:

```javascript
// On the receiver's machine
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(authTag);

// If the authTag doesn't match, this throws an error
const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
```

The relay server never sees the `key`. It only stores `{ ciphertext, iv, authTag }`. Without the key, that data is computationally indistinguishable from random noise.

---

## Why Not RSA or Other Algorithms?

| Algorithm | Type | Key exchange needed | Speed | Auth built in |
|---|---|---|---|---|
| AES-256-GCM | Symmetric | Yes (manual) | Very fast | Yes |
| RSA | Asymmetric | No | Slow (large data) | No |
| ChaCha20-Poly1305 | Symmetric | Yes | Fast | Yes |

For this use case — short-lived, one-shot `.env` file transfer — AES-256-GCM is the right choice:
- Fast for the data sizes involved
- Authentication built in (GCM mode)
- Well-supported natively in Node.js `crypto`
- The key exchange problem is solved by the share code mechanism

---

## Common Mistakes to Avoid

**Reusing an IV with the same key.** In GCM, IV reuse with the same key completely breaks the security model — it can leak the key itself. share-env generates a fresh random IV for every push.

**Not checking the auth tag.** If you skip `decipher.setAuthTag()`, you are doing unauthenticated encryption — you cannot detect tampering. Node.js will throw if you try to skip it with GCM mode.

**Using a short key.** 128-bit AES is still strong today, but 256-bit provides a larger security margin, especially as computing power increases.

---

## Conclusion

AES-256-GCM gives you:
- Confidentiality — your `.env` is unreadable without the key
- Integrity — any tampering is detected and rejected
- Authenticity — you know the ciphertext was produced with the correct key

For sharing environment secrets, this is exactly what you need. The key never touches the relay, the IV is random per push, and the auth tag ensures what you decrypt is exactly what was encrypted.
