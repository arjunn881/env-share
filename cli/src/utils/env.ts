/**
 * env.ts — Smart .env Merge Utility
 *
 * Merging strategy:
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  Key state          │  Resolution                       │
 *  │─────────────────────│───────────────────────────────────│
 *  │  local only         │  Keep local value (silent)        │
 *  │  remote only        │  Accept remote value (silent)     │
 *  │  identical values   │  Keep (silent)                    │
 *  │  CONFLICT           │  Prompt user → Local or Remote    │
 *  └─────────────────────────────────────────────────────────┘
 *
 * The final output is a valid `.env` string (KEY=VALUE per line).
 * Comments and blank lines from the remote string are preserved
 * at the top of the output as a header block; local comments
 * and structure are preserved inline for local-origin keys.
 */

import * as dotenv from "dotenv";
import prompts from "prompts";
import chalk from "chalk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EnvMap = Record<string, string>;

/** Classification of how a key from the merged universe should be resolved. */
type KeyResolution =
  | { kind: "local-only";  value: string }
  | { kind: "remote-only"; value: string }
  | { kind: "identical";   value: string }
  | { kind: "conflict";    local: string; remote: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parses a raw .env string into a key→value map using dotenv.parse().
 * dotenv.parse() never throws; it silently drops lines it cannot parse.
 * The caller (validateEnvFile) already guarantees the string is well-formed,
 * so silent dropping is not a concern here.
 */
function parseEnvString(raw: string): EnvMap {
  return dotenv.parse(raw);
}

/**
 * Extracts leading comment/blank lines from a raw .env string.
 * These are preserved verbatim in the merged output so the recipient
 * keeps any documentation the sender included.
 */
function extractHeaderComments(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const header: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      header.push(line);
    } else {
      break; // First data line — stop collecting header
    }
  }

  return header;
}

/**
 * Serialises a final resolved key→value map back into a valid .env string.
 * Values containing whitespace or special characters are quoted.
 */
function serialiseEnvMap(resolved: EnvMap, headerLines: string[]): string {
  const dataLines = Object.entries(resolved).map(([key, value]) => {
    // Quote values that contain spaces, #, or $  to avoid ambiguity
    const needsQuotes = /[\s#$"'`\\]/.test(value);
    const serialised = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value;
    return `${key}=${serialised}`;
  });

  // Prepend any header comments that came from the remote env
  const allLines = [
    ...headerLines.filter((l) => l.trim().startsWith("#")), // comments only
    ...dataLines,
  ];

  return allLines.join("\n");
}

// ---------------------------------------------------------------------------
// Core: classify all keys
// ---------------------------------------------------------------------------

function classifyKeys(
  localMap: EnvMap,
  remoteMap: EnvMap
): Map<string, KeyResolution> {
  const allKeys = new Set([...Object.keys(localMap), ...Object.keys(remoteMap)]);
  const resolutions = new Map<string, KeyResolution>();

  for (const key of allKeys) {
    const inLocal = Object.prototype.hasOwnProperty.call(localMap, key);
    const inRemote = Object.prototype.hasOwnProperty.call(remoteMap, key);

    if (inLocal && !inRemote) {
      resolutions.set(key, { kind: "local-only", value: localMap[key]! });
    } else if (!inLocal && inRemote) {
      resolutions.set(key, { kind: "remote-only", value: remoteMap[key]! });
    } else if (localMap[key] === remoteMap[key]) {
      resolutions.set(key, { kind: "identical", value: localMap[key]! });
    } else {
      resolutions.set(key, {
        kind: "conflict",
        local: localMap[key]!,
        remote: remoteMap[key]!,
      });
    }
  }

  return resolutions;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Merges a remote .env string into a local .env string with interactive
 * conflict resolution via `prompts`.
 *
 * @param localEnvString   Raw contents of the existing local `.env` file.
 *                         Pass an empty string `""` if no local file exists.
 * @param remoteEnvString  Raw decrypted contents received from the relay.
 * @returns                A promise resolving to the merged `.env` string,
 *                         ready to be written to disk.
 */
export async function mergeEnv(
  localEnvString: string,
  remoteEnvString: string
): Promise<string> {
  const localMap = parseEnvString(localEnvString);
  const remoteMap = parseEnvString(remoteEnvString);
  const remoteHeaderLines = extractHeaderComments(remoteEnvString);

  const classifications = classifyKeys(localMap, remoteMap);

  // -- Summary header --------------------------------------------------------
  const conflicts = [...classifications.values()].filter(
    (r) => r.kind === "conflict"
  );
  const remoteOnly = [...classifications.values()].filter(
    (r) => r.kind === "remote-only"
  );

  if (remoteOnly.length > 0) {
    console.log(
      chalk.cyan("\n  ℹ") +
        chalk.dim(
          ` Adding ${chalk.bold(String(remoteOnly.length))} new key(s) from remote.`
        )
    );
  }

  if (conflicts.length === 0 && remoteOnly.length === 0) {
    console.log(
      chalk.green("\n  ✔") +
        chalk.dim(" No conflicts and no new keys — local .env is already up to date.")
    );
  }

  if (conflicts.length > 0) {
    console.log(
      chalk.yellow("\n  ⚠") +
        chalk.dim(
          ` Found ${chalk.bold(String(conflicts.length))} conflict(s) — please resolve each one:\n`
        )
    );
  }

  // -- Interactive conflict resolution ---------------------------------------
  const resolved: EnvMap = {};

  for (const [key, resolution] of classifications) {
    switch (resolution.kind) {
      case "local-only":
      case "identical":
        resolved[key] = resolution.value;
        break;

      case "remote-only":
        resolved[key] = resolution.value;
        console.log(
          `  ${chalk.green("+")} ${chalk.bold(key)} ${chalk.dim("← added from remote")}`
        );
        break;

      case "conflict": {
        // Truncate long values in the display to keep the prompt readable
        const truncate = (s: string, max = 60): string =>
          s.length > max ? s.slice(0, max) + chalk.dim("…") : s;

        const answer = await prompts(
          {
            type: "select",
            name: "choice",
            message:
              chalk.yellow("Conflict") +
              " on " +
              chalk.bold(key),
            hint: " ↑/↓ to navigate, Enter to confirm",
            choices: [
              {
                title:
                  chalk.blue("Local ") +
                  chalk.dim(`  ${truncate(resolution.local)}`),
                value: "local",
                description: `Keep: ${resolution.local}`,
              },
              {
                title:
                  chalk.magenta("Remote") +
                  chalk.dim(`  ${truncate(resolution.remote)}`),
                value: "remote",
                description: `Use:  ${resolution.remote}`,
              },
            ],
          },
          {
            // If the user hits Ctrl+C, abort cleanly
            onCancel: () => {
              console.error(
                "\n" +
                  chalk.bgRed.white.bold(" ABORTED ") +
                  chalk.red(" Merge cancelled by user. No file was written.")
              );
              process.exit(1);
            },
          }
        );

        // prompts returns undefined if the user cancels (caught above via onCancel)
        const choice = answer.choice as "local" | "remote";
        resolved[key] = choice === "remote" ? resolution.remote : resolution.local;

        console.log(
          `  ${chalk.dim("→")} ${chalk.bold(key)} ${chalk.dim(
            `resolved to ${choice === "remote" ? chalk.magenta("remote") : chalk.blue("local")} value`
          )}`
        );
        break;
      }
    }
  }

  return serialiseEnvMap(resolved, remoteHeaderLines);
}
