# env-share

A command-line tool for securely sharing `.env` files between developers using end-to-end encryption and an ephemeral relay server. No accounts, no configuration, no secrets stored anywhere.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [How It Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Step-by-Step Workflow](#step-by-step-workflow)
- [CLI Reference](#cli-reference)
- [Security Model](#security-model)
- [Error Reference](#error-reference)
- [Self-Hosting the Relay Server](#self-hosting-the-relay-server)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

`env-share` eliminates the insecure practice of sharing `.env` files over Slack, Discord, email, or any other messaging platform. It encrypts your environment variables on your local machine before they ever leave your computer, uploads only the ciphertext to a temporary relay server, and gives you a one-time share code to pass to your teammate. The relay server permanently deletes the payload the moment it is pulled.

The relay server used by default is hosted at:

```
https://env-share-1rsi.onrender.com
```

---

## Features

**Zero-Knowledge Encryption**
The AES-256-GCM encryption key is generated locally and is never transmitted to the relay server. Even if the relay server were fully compromised, an attacker would only obtain useless ciphertext.

**Burn-After-Reading**
The encrypted payload is permanently and immediately deleted from the relay server the moment the receiver pulls it. It cannot be pulled a second time.

**Smart Merging**
If the receiver already has a local `.env` file, the tool does not overwrite it blindly. It compares each key and interactively asks the receiver to choose between their local value and the incoming value for every conflict.

**Git Guardrails**
The tool refuses to run if your project does not have a `.gitignore` that explicitly ignores `.env` files. This prevents accidental secret commits.

**Zero Setup**
Runs via `npx` with no global installation, no accounts, and no API keys required.

**TTL-Based Expiry**
Share codes automatically expire after 10 minutes if they are not used.

---

## How It Works

```
Developer A (Sender)                        Relay Server                    Developer B (Receiver)
        |                                        |                                    |
        |  1. Generate random 256-bit key        |                                    |
        |  2. Encrypt .env with AES-256-GCM      |                                    |
        |  3. POST ciphertext + IV + auth tag --> |                                    |
        |                                        |  4. Store payload, return phrase    |
        |  5. Build share code:                  |                                    |
        |     phrase#hexKey                      |                                    |
        |                                        |                                    |
        | ---- Share code sent out-of-band (Slack, Teams, etc.) ------------------> |
        |                                        |                                    |
        |                                        |  6. GET /pull/phrase           <-- |
        |                                        |  7. Return payload + DELETE    --> |
        |                                        |                                    |  8. Decrypt locally using hexKey
        |                                        |                                    |  9. Merge into local .env
```

The relay server at no point has access to the decryption key. The key travels exclusively inside the share code, which you transmit yourself through any out-of-band channel.

---

## Prerequisites

- Node.js version 18 or higher
- A project directory with a `.gitignore` file that ignores `.env` files
- A `.env` file (for the sender)

If you do not have a `.gitignore` that ignores `.env`, create or update it before running the tool:

```
# Add these lines to your .gitignore
.env
.env.*
```

---

## Quick Start

No installation is required. Run directly using `npx`:

**Sender:**
```bash
npx env-share-cli push
```

**Receiver:**
```bash
npx env-share-cli pull <share-code>
```

---

## Step-by-Step Workflow

This section describes the complete process for two developers collaborating on the same project.

### Scenario

- **Developer A** has the `.env` file with all required project secrets.
- **Developer B** has cloned the repository but does not have the `.env` file.

---

### Step 1: Developer B confirms their .gitignore is set up

Before anything else, Developer B should verify their local `.gitignore` contains the following:

```
.env
.env.*
```

The tool will refuse to run on either side if this is missing. This is a deliberate safety check.

---

### Step 2: Developer A navigates to the project root

Developer A opens a terminal and changes directory to the root of the project where the `.env` file is located.

```bash
cd /path/to/your/project
```

---

### Step 3: Developer A runs the push command

```bash
npx env-share-cli push
```

The tool will perform the following actions automatically:

1. Verify that `.gitignore` ignores `.env` files.
2. Read and validate the contents of `.env` (checks for malformed lines).
3. Generate a random 256-bit encryption key in local memory.
4. Generate a random 96-bit Initialization Vector (IV).
5. Encrypt the `.env` contents using AES-256-GCM.
6. Upload only the ciphertext, IV, and authentication tag to the relay server at `https://env-share-1rsi.onrender.com`.
7. Receive a 3-word identifier (e.g., `apple-brave-cloud`) from the relay server.
8. Construct the share code by appending the local encryption key after a `#` separator.
9. Display the share code in the terminal.

**Expected output:**

```
  3 key(s) loaded from .env

  Encrypted payload stored on relay.

  Payload uploaded. Your share code:

  +--------------------------------------------------+
  |  apple-brave-cloud#a3f9b2c1d4e5f6a7b8c9d0e1f2...  |
  +--------------------------------------------------+

  Send the code above to your teammate. It expires in 10 minutes.
  One-time use — it is deleted from the relay after the first pull.
```

---

### Step 4: Developer A sends the share code to Developer B

Developer A copies the full share code and sends it to Developer B through any available channel such as Slack, Microsoft Teams, Signal, or a direct message.

The share code looks like this:

```
apple-brave-cloud#a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
```

The portion before the `#` is the relay identifier. The portion after `#` is the decryption key. Both parts are required. The relay server only ever sees the identifier — not the key.

**The share code expires in 10 minutes.**

---

### Step 5: Developer B navigates to the project root

```bash
cd /path/to/your/project
```

---

### Step 6: Developer B runs the pull command

Developer B runs the following command, replacing `<share-code>` with the full code received from Developer A:

```bash
npx env-share-cli pull apple-brave-cloud#a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
```

The tool will perform the following actions:

1. Verify that `.gitignore` ignores `.env` files.
2. Parse the share code to extract the relay identifier and the decryption key.
3. Send a GET request to `https://env-share-1rsi.onrender.com/pull/apple-brave-cloud`.
4. The relay server returns the encrypted payload and **immediately and permanently deletes it**.
5. Decrypt the payload locally using the decryption key extracted from the share code.
6. Check if a `.env` file already exists at the target path.
   - If no `.env` exists: write the decrypted contents directly to `.env`.
   - If a `.env` already exists: compare each key with the incoming values and prompt for resolution on each conflict.
7. Write the final merged content to `.env`.

---

### Step 7: Developer B resolves any merge conflicts (if applicable)

If Developer B already has a `.env` file, the tool will display each conflicting key and ask which value to keep:

```
  Existing .env found — starting merge...

  Conflict: DATABASE_URL
    Local  : postgres://localhost:5432/mydb
    Remote : postgres://prod-host:5432/mydb
  ? Which value do you want to keep?
    > Keep local
      Use remote
```

Developer B selects a value for each conflict and the tool writes the final merged `.env` to disk.

**Expected final output:**

```
  Done!  .env written to: /path/to/your/project/.env
```

---

### Step 8: Verify

Developer B can confirm the file was written correctly:

```bash
cat .env
```

The `.env` file is now ready to use. The share code is permanently burned and cannot be used again.

---

## CLI Reference

### push

Encrypt and upload the local `.env` file to the relay server.

```
npx env-share-cli push [options]
```

| Option | Type | Default | Description |
|---|---|---|---|
| `-f, --file <path>` | string | `.env` | Path to the `.env` file to share |
| `--server <url>` | string | `https://env-share-1rsi.onrender.com` | Relay server base URL |

**Examples:**

```bash
# Share the default .env in the current directory
npx env-share-cli push

# Share a file at a custom path
npx env-share-cli push --file ./config/.env.production

# Use a custom self-hosted relay server
npx env-share-cli push --server https://your-relay.example.com
```

---

### pull

Download, decrypt, and merge a shared `.env` file.

```
npx env-share-cli pull <share-code> [options]
```

| Argument | Required | Description |
|---|---|---|
| `share-code` | Yes | The full share code received from the sender (format: `phrase#hexKey`) |

| Option | Type | Default | Description |
|---|---|---|---|
| `-f, --file <path>` | string | `.env` | Target path to write the decrypted `.env` |
| `--server <url>` | string | `https://env-share-1rsi.onrender.com` | Relay server base URL |

**Examples:**

```bash
# Pull into the default .env in the current directory
npx env-share-cli pull apple-brave-cloud#a3f9b2c1...

# Pull into a custom file path
npx env-share-cli pull apple-brave-cloud#a3f9b2c1... --file ./config/.env.local

# Pull using a custom relay server
npx env-share-cli pull apple-brave-cloud#a3f9b2c1... --server https://your-relay.example.com
```

---

## Security Model

### Encryption

When `push` is run, the following happens entirely within local memory before any network call:

1. A cryptographically random 256-bit (32-byte) symmetric key is generated using Node.js `crypto.randomBytes`.
2. A cryptographically random 96-bit (12-byte) Initialization Vector (IV) is generated.
3. The raw `.env` file contents are encrypted using AES-256-GCM.
4. AES-256-GCM produces two outputs in addition to the ciphertext: an IV and a 128-bit authentication tag. The authentication tag is used during decryption to verify that the ciphertext has not been tampered with.

### What the relay server receives

The relay server receives exactly three values:

- The ciphertext (encrypted bytes — unreadable without the key)
- The IV (required for decryption, but harmless without the key)
- The authentication tag (used to detect tampering, but harmless without the key)

**The relay server never receives the encryption key.**

### What the share code contains

The share code has the format `<phrase>#<hexKey>`:

- `<phrase>` is a 3-word identifier assigned by the relay server (e.g., `apple-brave-cloud`)
- `<hexKey>` is the 64-character hexadecimal representation of the 256-bit encryption key

The key travels only inside the share code, through whatever out-of-band channel you choose.

### Threat model

| Threat | Mitigation |
|---|---|
| Relay server is compromised | Attacker only has ciphertext. No key means no decryption. |
| Share code is intercepted in transit | Treat the share code like a password. Send it over encrypted channels (Slack, Teams, Signal). |
| Payload is pulled by the wrong person | The payload is deleted on first pull. If someone else pulls it first, the intended receiver will get a 404 error. |
| Payload is never pulled | The relay server automatically expires and deletes all payloads after 10 minutes. |
| Accidental `git add .env` | The Git guardrail check blocks the tool from running if `.gitignore` does not ignore `.env` files. |

---

## Error Reference

### FATAL: Your .gitignore does not ignore .env files

Your project's `.gitignore` file either does not exist or does not contain rules to ignore `.env` and `.env.*` files.

**Fix:** Add the following lines to your `.gitignore` and re-run the command:

```
.env
.env.*
```

---

### FATAL: Your .env file contains malformed lines

One or more lines in your `.env` file do not follow the required `KEY=VALUE` format.

**Fix:** Open your `.env` file and ensure every non-empty, non-comment line follows the format:

```
DATABASE_URL=postgres://localhost:5432/mydb
API_KEY=your_api_key_here
DEBUG=true
```

Comment lines (starting with `#`) and blank lines are allowed. Lines without an `=` separator are not.

---

### NOT FOUND: The phrase was not found on the relay server

The share code's identifier does not match any active payload on the relay server.

**Possible causes:**
- The payload was already pulled by someone else (burn-after-reading).
- The 10-minute TTL expired before the payload was pulled.
- The share code was copied incorrectly or truncated.

**Fix:** Ask the sender to run `push` again and generate a new share code.

---

### DECRYPTION FAILED

The decryption step failed, which means the authentication tag verification did not pass.

**Possible causes:**
- The share code was truncated when copying. The key portion (after the `#`) must be copied in full — it is 64 hexadecimal characters long.
- The share code was modified in transit.

**Fix:** Ask the sender to run `push` again and share the complete, unmodified share code.

---

## Self-Hosting the Relay Server

The relay server is open source and can be self-hosted for teams that require full control over their infrastructure.

### Requirements

- Node.js 18 or higher
- A server or cloud platform that can run a persistent Node.js process (e.g., Render, Railway, Fly.io, a VPS)

### Setup

Clone the repository and navigate to it:

```bash
git clone https://github.com/arjunn881/env-share.git
cd env-share
```

Install all dependencies:

```bash
npm install
```

Build both the server and CLI workspaces:

```bash
npm run build
```

Start the relay server:

```bash
npm start --workspace=server
```

By default the server listens on port `3000`. Set the `PORT` environment variable to change this:

```bash
PORT=8080 npm start --workspace=server
```

### Using your self-hosted server

Pass the `--server` flag to both `push` and `pull`:

```bash
npx env-share-cli push --server https://your-relay.example.com
npx env-share-cli pull <share-code> --server https://your-relay.example.com
```

### Relay server configuration

The relay server has the following built-in defaults which can be changed in `server/src/index.ts`:

| Setting | Default | Description |
|---|---|---|
| `TTL_SECONDS` | 600 (10 minutes) | Time before an uncollected payload is automatically deleted |
| `RATE_LIMIT_MAX` | 10 | Maximum requests per minute per IP address |
| `PORT` | 3000 | Port the server listens on (overridden by `PORT` env var) |

---

## Contributing

Contributions are welcome. Please open an issue before submitting a pull request for significant changes.

**Project structure:**

```
env-share/
  cli/          - The npm CLI package (env-share-cli)
    src/
      index.ts            - CLI entry point and command definitions
      utils/
        crypto.ts         - AES-256-GCM encrypt/decrypt logic
        env.ts            - Smart merge logic
        env-validator.ts  - .env file format validation
        git.ts            - .gitignore safety check
  server/       - The Express relay server
    src/
      index.ts            - Server entry point, route handlers, rate limiting
```

**To run the CLI locally:**

```bash
npm run dev:cli
```

**To run the server locally:**

```bash
npm run dev:server
```

**To build everything:**

```bash
npm run build
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
