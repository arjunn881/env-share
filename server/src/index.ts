/**
 * index.ts — env-share Relay Server
 *
 * Security model:
 *  - The server NEVER sees the decryption key. It only stores the
 *    ciphertext + IV + authTag as an opaque blob.
 *  - Each payload is deleted immediately on first retrieval (burn-after-reading).
 *  - TTL is 10 minutes. Expired blobs are purged automatically by node-cache.
 *  - Rate limiting: 10 requests / minute per IP to prevent enumeration & abuse.
 *  - Body size limit: 100 kb — well above any realistic .env file.
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import NodeCache from "node-cache";
import { generatePhrase } from "./wordlist";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const TTL_SECONDS = 10 * 60; // 10 minutes
const BODY_SIZE_LIMIT = "100kb";
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10;

// ---------------------------------------------------------------------------
// In-Memory TTL Store
// ---------------------------------------------------------------------------

/**
 * Each cached entry holds the encrypted payload sent by the CLI push command.
 * The server is intentionally kept dumb — it never inspects the inner fields.
 */
interface StoredPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
}

const cache = new NodeCache({
  stdTTL: TTL_SECONDS,
  checkperiod: 60, // Scan for expired keys every 60 s
  useClones: false, // Avoid extra allocations; we delete on read anyway
});

// ---------------------------------------------------------------------------
// Express App
// ---------------------------------------------------------------------------

const app = express();

// -- CORS: allow any origin (public relay) ------------------------------------
app.use(cors());

// -- Body parser with hard size cap ------------------------------------------
app.use(express.json({ limit: BODY_SIZE_LIMIT }));

// -- Global rate limiter ------------------------------------------------------
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,
  message: {
    error: "Too many requests — please wait before trying again.",
  },
  // Trust proxy headers if deployed behind a reverse proxy (e.g., nginx, Fly.io)
  // Set to false when running locally without a proxy.
  skip: () => process.env.NODE_ENV === "test",
});

app.use(limiter);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /push
 *
 * Body: { iv: string, authTag: string, ciphertext: string }
 *
 * Validates the shape of the payload, generates a unique 3-word phrase,
 * stores the payload under that phrase with a 10-minute TTL, and returns
 * the phrase to the caller.
 *
 * The decryption key is NEVER sent to this endpoint — it travels only in
 * the share code that the sender gives directly to the recipient.
 */
app.post("/push", (req: Request, res: Response): void => {
  const { iv, authTag, ciphertext } = req.body as Partial<StoredPayload>;

  // -- Input validation -------------------------------------------------------
  if (
    typeof iv !== "string" ||
    typeof authTag !== "string" ||
    typeof ciphertext !== "string" ||
    iv.length === 0 ||
    authTag.length === 0 ||
    ciphertext.length === 0
  ) {
    res.status(400).json({
      error: "Invalid payload. Expected: { iv, authTag, ciphertext } as hex strings.",
    });
    return;
  }

  // -- Collision-resistant phrase generation ----------------------------------
  let phrase = generatePhrase();
  let attempts = 0;
  const MAX_ATTEMPTS = 10;

  while (cache.has(phrase)) {
    phrase = generatePhrase();
    attempts++;
    if (attempts >= MAX_ATTEMPTS) {
      // Extremely unlikely, but guard against a pathological cache state
      res.status(503).json({ error: "Server busy — please retry in a moment." });
      return;
    }
  }

  // -- Store with TTL ---------------------------------------------------------
  const stored = cache.set<StoredPayload>(phrase, { iv, authTag, ciphertext });

  if (!stored) {
    res.status(500).json({ error: "Failed to store payload. Please retry." });
    return;
  }

  console.log(`[push] Stored payload under phrase="${phrase}" (TTL=${TTL_SECONDS}s)`);

  res.status(201).json({ phrase });
});

/**
 * GET /pull/:phrase
 *
 * Retrieves the encrypted payload associated with the given phrase and
 * immediately deletes it (burn-after-reading). Returns 404 if the phrase
 * is unknown or the payload has already been consumed / expired.
 */
app.get("/pull/:phrase", (req: Request, res: Response): void => {
  const { phrase } = req.params;

  // Basic sanity check: phrase must look like word-word-word
  if (!/^[a-z]+-[a-z]+-[a-z]+$/.test(phrase)) {
    res.status(400).json({ error: "Invalid phrase format." });
    return;
  }

  const payload = cache.get<StoredPayload>(phrase);

  if (!payload) {
    res.status(404).json({
      error: "Phrase not found, already used, or expired.",
    });
    return;
  }

  // -- Burn after reading: delete immediately ---------------------------------
  cache.del(phrase);

  console.log(`[pull] Payload consumed for phrase="${phrase}"`);

  res.status(200).json(payload);
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/health", (_req: Request, res: Response): void => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    cachedItems: cache.getStats().keys,
  });
});

// ---------------------------------------------------------------------------
// 404 catch-all
// ---------------------------------------------------------------------------

app.use((_req: Request, res: Response): void => {
  res.status(404).json({ error: "Not found." });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error("[error]", err.message);
  res.status(500).json({ error: "Internal server error." });
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`\n env-share relay server running on http://localhost:${PORT}`);
  console.log(`   TTL: ${TTL_SECONDS / 60} min | Rate limit: ${RATE_LIMIT_MAX} req/min/IP\n`);
});

export { app }; // Export for testing
