/**
 * env.test.ts — Tests for mergeEnv (all paths, including conflict resolution)
 *
 * Run with: npx tsx src/utils/env.test.ts
 *
 * `prompts` v2 exposes an `inject()` function that pre-queues answers for
 * interactive prompts. When a prompt fires it dequeues the next injected value
 * instead of waiting for keyboard input — making headless testing possible
 * without mocking the module.
 *
 * Injected values must match the `value` field of the prompt's choices:
 *   "local"  → keep the local value
 *   "remote" → use the remote value
 */

import prompts from "prompts";
import * as dotenv from "dotenv";
import { mergeEnv } from "./env.js";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    console.log(`  ✅ PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL  ${name}`);
    console.error(`         ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

/** Assert a key=value pair exists in the merged .env output string. */
function assertKey(result: string, key: string, expectedValue: string): void {
  const parsed = dotenv.parse(result);
  if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
    throw new Error(`Key "${key}" not found in merged output.\nOutput:\n${result}`);
  }
  if (parsed[key] !== expectedValue) {
    throw new Error(
      `Key "${key}": expected "${expectedValue}", got "${parsed[key]}"`
    );
  }
}

/** Assert a key is absent from the merged .env output string. */
function assertNoKey(result: string, key: string): void {
  const parsed = dotenv.parse(result);
  if (Object.prototype.hasOwnProperty.call(parsed, key)) {
    throw new Error(
      `Key "${key}" should be absent but has value "${parsed[key]}"`
    );
  }
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const LOCAL_ENV = [
  "PORT=3000",
  "DB_URL=postgres://localhost/local_db",
  "LOCAL_ONLY=i-am-local",
  "SHARED_IDENTICAL=same-value",
  "CONFLICT_KEY=local-version",
].join("\n");

const REMOTE_ENV = [
  "# Shared by Alice — 2026-05-21",
  "PORT=4000",
  "DB_URL=postgres://prod-host/prod",
  "REMOTE_ONLY=i-am-remote",
  "SHARED_IDENTICAL=same-value",
  "CONFLICT_KEY=remote-version",
].join("\n");

// ---------------------------------------------------------------------------
// Main — wrapped in async IIFE for CJS compatibility (no top-level await)
// ---------------------------------------------------------------------------

void (async () => {
  console.log("\n🔀 env-share — mergeEnv Test Suite\n");

  await test("Local-only keys are preserved in output", async () => {
    prompts.inject(["local", "local", "local"]);
    const result = await mergeEnv(LOCAL_ENV, REMOTE_ENV);
    assertKey(result, "LOCAL_ONLY", "i-am-local");
  });

  await test("Remote-only keys are added automatically (no prompt)", async () => {
    prompts.inject(["local", "local", "local"]);
    const result = await mergeEnv(LOCAL_ENV, REMOTE_ENV);
    assertKey(result, "REMOTE_ONLY", "i-am-remote");
  });

  await test("Identical values are preserved without prompting", async () => {
    prompts.inject(["local", "local", "local"]);
    const result = await mergeEnv(LOCAL_ENV, REMOTE_ENV);
    assertKey(result, "SHARED_IDENTICAL", "same-value");
  });

  await test("Conflict: user chooses 'local' → local value kept", async () => {
    prompts.inject(["local", "local", "local"]);
    const result = await mergeEnv(LOCAL_ENV, REMOTE_ENV);
    assertKey(result, "CONFLICT_KEY", "local-version");
    assertKey(result, "PORT", "3000");
    assertKey(result, "DB_URL", "postgres://localhost/local_db");
  });

  await test("Conflict: user chooses 'remote' → remote value used", async () => {
    prompts.inject(["remote", "remote", "remote"]);
    const result = await mergeEnv(LOCAL_ENV, REMOTE_ENV);
    assertKey(result, "CONFLICT_KEY", "remote-version");
    assertKey(result, "PORT", "4000");
    assertKey(result, "DB_URL", "postgres://prod-host/prod");
  });

  await test("Conflict: mixed choices — PORT remote, CONFLICT_KEY local", async () => {
    prompts.inject(["remote", "local", "local"]);
    const result = await mergeEnv(LOCAL_ENV, REMOTE_ENV);
    assertKey(result, "PORT", "4000");
    assertKey(result, "DB_URL", "postgres://localhost/local_db");
    assertKey(result, "CONFLICT_KEY", "local-version");
  });

  await test("Empty local → all remote keys are added", async () => {
    const result = await mergeEnv("", "API_KEY=abc\nSECRET=xyz");
    assertKey(result, "API_KEY", "abc");
    assertKey(result, "SECRET", "xyz");
  });

  await test("Empty remote → all local keys are preserved", async () => {
    const result = await mergeEnv("FOO=bar\nBAZ=qux", "");
    assertKey(result, "FOO", "bar");
    assertKey(result, "BAZ", "qux");
  });

  await test("Both empty → output has no keys", async () => {
    const result = await mergeEnv("", "");
    const parsed = dotenv.parse(result);
    if (Object.keys(parsed).length !== 0) {
      throw new Error(`Expected 0 keys, got: ${JSON.stringify(parsed)}`);
    }
  });

  await test("Values with spaces are serialised and re-parsed correctly", async () => {
    const result = await mergeEnv("", "GREETING=hello world\nNAME=Jane Doe");
    assertKey(result, "GREETING", "hello world");
    assertKey(result, "NAME", "Jane Doe");
  });

  await test("Remote comment header is not parsed as a key", async () => {
    const result = await mergeEnv("", "# This is a comment\nFOO=bar");
    assertNoKey(result, "# This is a comment");
    assertKey(result, "FOO", "bar");
  });

  await test("Unicode values round-trip through merge correctly", async () => {
    const result = await mergeEnv("", "UNICODE=héllo wörld 🔐");
    assertKey(result, "UNICODE", "héllo wörld 🔐");
  });

  await test("Empty remote value treated as conflict with existing local key", async () => {
    prompts.inject(["local"]);
    const result = await mergeEnv("KEY=existing", "KEY=");
    assertKey(result, "KEY", "existing");
  });

  await test("Empty remote value: choosing remote gives empty string", async () => {
    prompts.inject(["remote"]);
    const result = await mergeEnv("KEY=existing", "KEY=");
    assertKey(result, "KEY", "");
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total`);
  console.log(`${"─".repeat(50)}\n`);

  if (failed > 0) process.exit(1);
})();
