/**
 * git.ts
 *
 * Named alias for the pre-flight git guardrail, matching the project's
 * public API convention (`checkGitIgnore`).
 *
 * The full implementation lives in `preflight.ts` (already tested).
 * This module re-exports it under the spec-mandated name so that
 * command handlers can import it without knowing the internal filename.
 */

export { runPreflight as checkGitIgnore } from "./preflight.js";
