
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
import { checkbox } from "@inquirer/prompts";
import dotenv from "dotenv";
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
  .name("share-env")
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
  .command("push [scope]")
  .description("Encrypt and upload your .env to the relay, receive a share code")
  .option("-s, --select", "Interactively select which variables to share")
  .option("-f, --file <path>", "Path to the .env file to share")
  .option("--server <url>", "Relay server base URL", DEFAULT_SERVER)
  .action(async (scope: string | undefined, opts: { select?: boolean; file?: string; server: string }) => {
    // ── 1. File Resolution ───────────────────────────────────────────────────
    let targetFileName = ".env";
    if (scope) {
      targetFileName = `.env.${scope}`;
    }
    if (opts.file) {
      targetFileName = opts.file;
    }

    // ── 2. Safety guardrails ────────────────────────────────────────────────
    checkGitIgnore();

    // ── 3. Validate & Parse .env ────────────────────────────────────────────
    let { raw, filePath, keyCount } = validateEnvFile(targetFileName);
    console.log(
      "\n" +
        chalk.green("  ✔") +
        chalk.dim(
          `  ${chalk.bold(String(keyCount))} key(s) loaded from ${chalk.underline(filePath)}`
        )
    );

    // ── 4. Selective Push Logic ─────────────────────────────────────────────
    if (opts.select) {
      const parsed = dotenv.parse(raw);
      const keys = Object.keys(parsed);
      
      if (keys.length === 0) {
        console.log(chalk.yellow("  No keys found to share. Exiting."));
        process.exit(0);
      }

      const selectedKeys = await checkbox({
        message: 'Select variables to share:',
        choices: keys.map(k => ({ name: k, value: k, checked: true }))
      });

      if (selectedKeys.length === 0) {
        console.log(chalk.yellow("  No variables selected. Exiting."));
        process.exit(0);
      }

      raw = selectedKeys.map(k => `${k}=${parsed[k]}`).join("\n");
      keyCount = selectedKeys.length;
      
      console.log(
        chalk.green("  ✔") +
        chalk.dim(
          `  Selected ${chalk.bold(String(keyCount))} key(s) to share.`
        )
      );
    }

    // ── 5. Encrypt ──────────────────────────────────────────────────────────
    const { localKeyHex, serverPayload } = encryptEnv(raw);
    
    const targetFileBaseName = path.basename(filePath);
    const payloadToUpload = { 
      ...serverPayload, 
      metadata: { targetFile: targetFileBaseName } 
    };

    // ── 6. Upload ───────────────────────────────────────────────────────────
    const spinner = ora({
      text: chalk.dim("Uploading encrypted payload to relay…"),
      color: "cyan",
    }).start();

    let phrase: string;

    try {
      const response = await axios.post<{ phrase: string }>(
        `${opts.server}/push`,
        payloadToUpload,
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

    // ── 7. Build & display share code ───────────────────────────────────────
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
  .option("-f, --file <path>", "Target .env file path")
  .option("--server <url>", "Relay server base URL", DEFAULT_SERVER)
  .action(async (shareCode: string, opts: { file?: string; server: string }) => {
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
              chalk.dim("  Copy the full share code exactly as printed by `share-env push`.")
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

    type ExtendedPayload = ServerPayload & { metadata?: { targetFile: string } };
    let serverPayload: ExtendedPayload;

    try {
      const response = await axios.get<ExtendedPayload>(
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

    // ── 5. File Resolution ──────────────────────────────────────────────────
    const targetFileName = opts.file || serverPayload.metadata?.targetFile || ".env";
    const envPath = path.resolve(targetFileName);
    let finalContent: string;

    // ── 6. Merge or write ───────────────────────────────────────────────────
    if (fs.existsSync(envPath)) {
      const localContent = fs.readFileSync(envPath, "utf8");
      console.log(
        chalk.dim(`\n  Existing file found at ${chalk.underline(envPath)} — starting merge…\n`)
      );
      finalContent = await mergeEnv(localContent, plaintext);
    } else {
      console.log(chalk.dim(`\n  No existing file at ${chalk.underline(envPath)} — writing fresh file.\n`));
      finalContent = plaintext;
    }

    // ── 7. Write to disk ────────────────────────────────────────────────────
    fs.writeFileSync(envPath, finalContent + "\n", "utf8");

    console.log(
      "\n" +
        chalk.bold.green("  ✔  Done!") +
        chalk.dim(`  ${targetFileName} written to: `) +
        chalk.underline(envPath) +
        "\n"
    );

   console.log(chalk.dim('\n---'));
   console.log(chalk.dim('Built by Arjuna - Full-Stack Developer.'));
   console.log(chalk.dim('Connect with me: https://github.com/arjunn881'));
  });

// ---------------------------------------------------------------------------
// Parse argv
// ---------------------------------------------------------------------------

program.parse(process.argv);
