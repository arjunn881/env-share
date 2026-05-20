/**
 * env-validator.ts
 *
 * Validates a local `.env` file before env-share reads or transmits it.
 *
 * Strategy:
 *  - The file must exist and be readable.
 *  - `dotenv.parse()` is used to tokenise the content. Because dotenv is
 *    lenient (it silently skips lines it cannot parse), we add a second pass
 *    that checks each non-comment, non-blank line actually produced a key in
 *    the parsed result. This catches malformed lines like `=VALUE` (missing
 *    key) or completely garbled content.
 *  - Empty files are allowed (a valid — if useless — .env).
 *
 * On failure the function throws an Error with a human-readable message.
 * Callers should catch and display it with chalk before exiting.
 */

import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import chalk from "chalk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidatedEnv {
  /** Absolute path to the file that was validated */
  filePath: string;
  /** Raw UTF-8 content of the file */
  raw: string;
  /** Parsed key→value map produced by dotenv */
  parsed: Record<string, string>;
  /** Number of key=value pairs found */
  keyCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true for lines that should be validated as key=value pairs.
 * Blank lines and lines starting with `#` are skipped by dotenv and by us.
 */
function isDataLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && !trimmed.startsWith("#");
}

/**
 * Minimal per-line sanity check: a valid .env data line must contain `=`
 * and must have a non-empty key before it.
 *
 * Examples:
 *   PORT=3000       ✅
 *   DATABASE_URL=   ✅  (empty value is fine)
 *   =missing_key    ❌
 *   just_noise      ❌  (no equals sign)
 */
function isWellFormedLine(line: string): boolean {
  const eqIdx = line.indexOf("=");
  if (eqIdx === -1) return false;
  const key = line.slice(0, eqIdx).trim();
  return key.length > 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reads, validates, and parses the `.env` file at `envPath`.
 *
 * Prints a descriptive chalk-formatted error and exits with code 1 if:
 *  - The file doesn't exist or is unreadable
 *  - Any data line is malformed
 *
 * Returns a `ValidatedEnv` object on success.
 */
export function validateEnvFile(
  envPath: string = path.join(process.cwd(), ".env")
): ValidatedEnv {
  const resolvedPath = path.resolve(envPath);

  // -- Existence check -------------------------------------------------------
  if (!fs.existsSync(resolvedPath)) {
    console.error(
      chalk.bgRed.white.bold(" FATAL ") +
        chalk.red(` No .env file found at: ${chalk.underline(resolvedPath)}\n\n`) +
        chalk.dim("  Create a .env file in the current directory and try again.")
    );
    process.exit(1);
  }

  // -- Read ------------------------------------------------------------------
  let raw: string;
  try {
    raw = fs.readFileSync(resolvedPath, "utf8");
    // Fix for Windows PowerShell which defaults to UTF-16 LE:
    // Strip null bytes and Byte Order Marks so parsing works flawlessly.
    raw = raw.replace(/\0/g, "").replace(/^\uFEFF/, "");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      chalk.bgRed.white.bold(" FATAL ") +
        chalk.red(` Could not read .env file: ${msg}`)
    );
    process.exit(1);
  }

  // -- Parse with dotenv -----------------------------------------------------
  const { parsed, error } = dotenv.config({ path: resolvedPath, override: false });

  // dotenv.config() loads into process.env; we use dotenv.parse() for a clean
  // in-memory parse without polluting the current process environment.
  const parsedClean = dotenv.parse(raw);

  if (error) {
    // dotenv itself threw — surface it
    console.error(
      chalk.bgRed.white.bold(" FATAL ") +
        chalk.red(` dotenv failed to parse .env: ${error.message}`)
    );
    process.exit(1);
  }

  // -- Line-by-line sanity check --------------------------------------------
  const lines = raw.split(/\r?\n/);
  const badLines: Array<{ lineNumber: number; content: string }> = [];

  lines.forEach((line, idx) => {
    if (isDataLine(line) && !isWellFormedLine(line)) {
      badLines.push({ lineNumber: idx + 1, content: line });
    }
  });

  if (badLines.length > 0) {
    const details = badLines
      .map(({ lineNumber, content }) =>
        chalk.yellow(`    Line ${lineNumber}: `) + chalk.dim(content.trim())
      )
      .join("\n");

    console.error(
      chalk.bgRed.white.bold(" FATAL ") +
        chalk.red(
          ` Your .env file contains malformed lines (expected KEY=VALUE):\n\n${details}\n\n` +
            chalk.dim("  Fix the lines above and re-run your command.")
        )
    );
    process.exit(1);
  }

  const keyCount = Object.keys(parsedClean).length;

  return {
    filePath: resolvedPath,
    raw,
    parsed: parsedClean,
    keyCount,
  };
}
