#!/usr/bin/env node
/**
 * index.ts — env-share CLI entry point
 *
 * Commands
 * ────────
 *  push   Encrypt and upload the local .env to the relay. Prints a share code.
 *  pull   Download, decrypt, and merge a shared .env into the local one.
 *
 * Security invariant:
 *  The decryption key NEVER leaves the sender's machine via the network.
 *  It travels only inside the share code the user copies manually.
 */


import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import axios, { type AxiosError } from "axios";
import fs from "fs";
import path from "path";

import { checkGitIgnore } from "./utils/git.js";
import { validateEnvFile } from "./utils/env-validator.js";
import { encryptEnv, decryptEnv, type ServerPayload } from "./utils/crypto.js";
import { mergeEnv } from "./utils/env.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const DEFAULT_SERVER = "https://env-share-1rsi.onrender.com";

/** Pretty-print an Axios or generic error and exit(1). */
function fatalNetworkError(err: unknown, context: string): never {
  const axErr = err as AxiosError<{ error?: string }>;

  if (axios.isAxiosError(axErr)) {
    const status = axErr.response?.status ?? "ERR";
    const serverMsg = axErr.response?.data?.error;

    if (axErr.response?.status === 404) {
      console.error(
        "\n" +
          chalk.bgRed.white.bold(" NOT FOUND ") +
          chalk.red(
            " The phrase was not found on the relay server.\n\n" +
              "  Possible reasons:\n" +
              "    • The payload already been pulled (burn-after-reading).\n" +
              "    • The 10-minute TTL expired.\n" +
              "    • The share code was mistyped."
          )
      );
    } else {
      console.error(
        "\n" +
          chalk.bgRed.white.bold(` ${context} FAILED `) +
          chalk.red(` [${status}] ${serverMsg ?? axErr.message}`)
      );
    }
  } else {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      "\n" +
        chalk.bgRed.white.bold(` ${context} FAILED `) +
        chalk.red(
          ` Could not reach the relay server.\n\n` +
            `  ${chalk.dim(msg)}\n\n` +
            `  Is the server running? (default: ${DEFAULT_SERVER})`
        )
    );
  }

  process.exit(1);
}

/** Render the final share code in a prominent terminal box. */
function printShareCode(shareCode: string): void {
  const label = " Share code ";
  const pad = 2;
  const inner = " ".repeat(pad) + shareCode + " ".repeat(pad);
  const width = Math.max(inner.length, label.length + 4);
  const top = "┌" + "─".repeat(width) + "┐";
  const mid = "│" + inner.padEnd(width) + "│";
  const bot = "└" + "─".repeat(width) + "┘";

  console.log("\n" + chalk.bold.green("  ✔  Payload uploaded. Your share code:\n"));
  console.log(chalk.dim("  " + top));
  console.log(chalk.cyan("  " + mid));
  console.log(chalk.dim("  " + bot));
  console.log(
    "\n" +
      chalk.dim("  Send the code above to your teammate. It expires in ") +
      chalk.bold("10 minutes") +
      chalk.dim(".\n") +
      chalk.dim("  One-time use — it is deleted from the relay after the first pull.\n")
  );
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name("env-share")
  .description(
    chalk.cyan.bold("env-share") +
      " — ephemeral, zero-setup peer-to-peer .env sharing\n" +
      chalk.dim("  E2E encrypted. The relay server never sees your decryption key.")
  )
  .version("1.0.0", "-v, --version", "Print version");

// ---------------------------------------------------------------------------
// push
// ---------------------------------------------------------------------------

program
  .command("push")
  .description("Encrypt and upload your .env to the relay, receive a share code")
  .option("-f, --file <path>", "Path to the .env file to share", ".env")
  .option("--server <url>", "Relay server base URL", DEFAULT_SERVER)
  .action(async (opts: { file: string; server: string }) => {
    // ── 1. Safety guardrails ────────────────────────────────────────────────
    checkGitIgnore();

    // ── 2. Validate .env ────────────────────────────────────────────────────
    const { raw, filePath, keyCount } = validateEnvFile(opts.file);
    console.log(
      "\n" +
        chalk.green("  ✔") +
        chalk.dim(
          `  ${chalk.bold(String(keyCount))} key(s) loaded from ${chalk.underline(filePath)}`
        )
    );

    // ── 3. Encrypt ──────────────────────────────────────────────────────────
    const { localKeyHex, serverPayload } = encryptEnv(raw);

    // ── 4. Upload ───────────────────────────────────────────────────────────
    const spinner = ora({
      text: chalk.dim("Uploading encrypted payload to relay…"),
      color: "cyan",
    }).start();

    let phrase: string;

    try {
      const response = await axios.post<{ phrase: string }>(
        `${opts.server}/push`,
        serverPayload,
        {
          headers: { "Content-Type": "application/json" },
          timeout: 10_000,
        }
      );

      phrase = response.data.phrase;
      spinner.succeed(chalk.dim("Encrypted payload stored on relay."));
    } catch (err) {
      spinner.fail(chalk.red("Upload failed."));
      fatalNetworkError(err, "UPLOAD");
    }

    // ── 5. Build & display share code ───────────────────────────────────────
    //
    //  Format:  <3-word-phrase>#<64-char-hex-key>
    //
    //  The phrase → addresses the payload on the relay.
    //  The hex key → decrypts it locally. The relay never sees this half.
    //
    const shareCode = `${phrase}#${localKeyHex}`;
    printShareCode(shareCode);
  });

// ---------------------------------------------------------------------------
// pull
// ---------------------------------------------------------------------------

program
  .command("pull <shareCode>")
  .description("Download, decrypt, and merge a shared .env into your local one")
  .option("-f, --file <path>", "Target .env file path", ".env")
  .option("--server <url>", "Relay server base URL", DEFAULT_SERVER)
  .action(async (shareCode: string, opts: { file: string; server: string }) => {
    // ── 1. Safety guardrails ────────────────────────────────────────────────
    checkGitIgnore();

    // ── 2. Parse share code ─────────────────────────────────────────────────
    const hashIdx = shareCode.indexOf("#");

    if (hashIdx === -1 || hashIdx === 0 || hashIdx === shareCode.length - 1) {
      console.error(
        "\n" +
          chalk.bgRed.white.bold(" ERROR ") +
          chalk.red(
            " Invalid share code format.\n\n" +
              "  Expected: " +
              chalk.yellow("<word-word-word#hexKey>") +
              "\n\n" +
              chalk.dim("  Copy the full share code exactly as printed by `env-share push`.")
          )
      );
      process.exit(1);
    }

    const phrase = shareCode.slice(0, hashIdx);
    const localKeyHex = shareCode.slice(hashIdx + 1);

    console.log(
      "\n" +
        chalk.dim(`  Phrase : ${chalk.bold(phrase)}`) +
        "\n" +
        chalk.dim(`  Server : ${opts.server}\n`)
    );

    // ── 3. Fetch encrypted payload ──────────────────────────────────────────
    const spinner = ora({
      text: chalk.dim("Fetching encrypted payload from relay…"),
      color: "cyan",
    }).start();

    let serverPayload: ServerPayload;

    try {
      const response = await axios.get<ServerPayload>(
        `${opts.server}/pull/${encodeURIComponent(phrase)}`,
        { timeout: 10_000 }
      );
      serverPayload = response.data;
      spinner.succeed(chalk.dim("Payload fetched & deleting from relay (burn-after-reading)."));
    } catch (err) {
      spinner.fail(chalk.red("Fetch failed."));
      fatalNetworkError(err, "FETCH");
    }

    // ── 4. Decrypt ──────────────────────────────────────────────────────────
    let plaintext: string;

    try {
      plaintext = decryptEnv(serverPayload, localKeyHex);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        "\n" +
          chalk.bgRed.white.bold(" DECRYPTION FAILED ") +
          chalk.red(`\n\n  ${msg}\n\n`) +
          chalk.dim(
            "  Double-check that you copied the full share code without\n" +
              "  any truncation — the key follows the '#' character."
          )
      );
      process.exit(1);
    }

    // ── 5. Merge or write ───────────────────────────────────────────────────
    const envPath = path.resolve(opts.file);
    let finalContent: string;

    if (fs.existsSync(envPath)) {
      const localContent = fs.readFileSync(envPath, "utf8");
      console.log(
        chalk.dim(`\n  Existing .env found at ${chalk.underline(envPath)} — starting merge…\n`)
      );
      finalContent = await mergeEnv(localContent, plaintext);
    } else {
      console.log(chalk.dim(`\n  No existing .env — writing fresh file.\n`));
      finalContent = plaintext;
    }

    // ── 6. Write to disk ────────────────────────────────────────────────────
    fs.writeFileSync(envPath, finalContent + "\n", "utf8");

    console.log(
      "\n" +
        chalk.bold.green("  ✔  Done!") +
        chalk.dim("  .env written to: ") +
        chalk.underline(envPath) +
        "\n"
    );
  });

// ---------------------------------------------------------------------------
// Parse argv
// ---------------------------------------------------------------------------

program.parse(process.argv);
