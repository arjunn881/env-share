/**
 * preflight.ts
 *
 * Safety guardrail: ensures the project is safe to use env-share in.
 *
 * Rules (both must pass):
 *  1. A `.gitignore` file must exist in the current working directory.
 *  2. That `.gitignore` must contain a line that covers `.env` files
 *     (matches: `.env`, `.env.*`, `*.env`, `**\/.env`, etc.).
 *
 * If either check fails, chalk prints a fatal error block and the process
 * exits with code 1 — nothing is read or transmitted.
 */

import fs from "fs";
import path from "path";
import chalk from "chalk";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the given `.gitignore` content contains at least one
 * non-comment line that would match a `.env` file.
 *
 * We intentionally keep the heuristic simple and developer-friendly rather
 * than implementing a full gitignore path-spec parser.
 */
function gitignoreCoversEnv(content: string): boolean {
  const lines = content.split(/\r?\n/);

  return lines.some((raw) => {
    const line = raw.trim();

    // Skip blank lines and comments
    if (line === "" || line.startsWith("#")) return false;

    // Patterns we consider sufficient:
    //   .env          exact file
    //   .env.*        e.g. .env.local, .env.production
    //   *.env         e.g. my.env
    //   **/.env       nested
    //   .env*         broad prefix match
    return /^(\*\*\/)?\.env(\.\*|\*)?$/.test(line) || line === "*.env";
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the pre-flight safety check for the current working directory.
 *
 * Exits the process with code 1 and a descriptive chalk-formatted message
 * if any check fails. Returns normally (void) if all checks pass.
 */
export function runPreflight(cwd: string = process.cwd()): void {
  const gitignorePath = path.join(cwd, ".gitignore");

  // -- Check 1: .gitignore must exist ----------------------------------------
  if (!fs.existsSync(gitignorePath)) {
    console.error(
      chalk.bgRed.white.bold(" FATAL ") +
        chalk.red(
          " No .gitignore found in the current directory.\n\n" +
            "  env-share refuses to run without a .gitignore to protect you from\n" +
            "  accidentally committing secrets to git.\n\n" +
            "  Fix: create a .gitignore and add the following line:\n\n" +
            chalk.yellow("    .env\n\n") +
            "  Then re-run your command."
        )
    );
    process.exit(1);
  }

  // -- Check 2: .gitignore must cover .env files -----------------------------
  const content = fs.readFileSync(gitignorePath, "utf8");

  if (!gitignoreCoversEnv(content)) {
    console.error(
      chalk.bgRed.white.bold(" FATAL ") +
        chalk.red(
          " Your .gitignore does not ignore .env files.\n\n" +
            "  Proceeding without this safeguard could expose your secrets if\n" +
            "  you accidentally run `git add .`.\n\n" +
            "  Fix: open your .gitignore and add:\n\n" +
            chalk.yellow("    .env\n    .env.*\n\n") +
            "  Then re-run your command."
        )
    );
    process.exit(1);
  }

  // All clear — return silently so the caller can proceed.
}
