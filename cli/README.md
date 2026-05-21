# env-share

An ephemeral, zero-setup CLI tool for developers to securely share .env files peer-to-peer.

Stop copy-pasting your environment variables through Slack, Discord, or email. env-share uses end-to-end encryption and a "burn-after-reading" relay server to ensure your secrets stay secret.

---

## Features

- **Zero-Knowledge E2E Encryption**: Uses AES-256-GCM. The encryption key never leaves your machine and is never sent to the relay server.
- **Burn-After-Reading**: Payloads are instantly and permanently deleted from the relay server the moment they are pulled.
- **Smart Merging**: If the receiver already has a .env file, env-share interactively prompts you to resolve any conflicting keys (Local vs. Remote) instead of overwriting your entire file.
- **Git Guardrails**: The CLI strictly refuses to run unless your project has a .gitignore file that actively ignores .env files, preventing accidental secret commits.
- **Zero Setup**: Works out of the box via npx. No accounts, no logins, no configuration.

---

## Workflow: 1 Project, 2 Contributors

Here is the exact step-by-step process for securely sharing an environment configuration between two developers working on the same repository.

### Scenario
- **Developer A (The Sender)** has the latest local .env file containing the required project secrets.
- **Developer B (The Receiver)** has cloned the repository but does not have a local .env file yet (or has an outdated one).

### Step 1: Developer A pushes the environment variables
Developer A navigates to the root of their local project directory and runs:

```bash
npx env-share-cli-tool push
```

The CLI will:
1. Verify that a .gitignore exists and correctly ignores `.env` files to keep your repository safe.
2. Generate a random 256-bit encryption key locally.
3. Encrypt the .env file with AES-256-GCM using that key.
4. Upload the encrypted ciphertext to the default relay server.
5. Print a secure Share Code containing a friendly 3-word phrase and the encryption key (separated by a hash character):

```text
Share Code: apple-brave-cloud#50bbfaebb9...
```

*Note: The key after the "#" symbol remains completely local. It is never transmitted to the relay server.*

### Step 2: Developer A sends the Share Code to Developer B
Developer A copies the printed Share Code and shares it with Developer B through a secure channel (e.g., Slack, Signal, Microsoft Teams).

**The code will expire and be permanently deleted from the relay server after 10 minutes if it is not pulled.**

### Step 3: Developer B pulls the environment variables
Developer B navigates to the root of their cloned repository and runs the pull command:

```bash
npx env-share-cli-tool pull apple-brave-cloud#50bbfaebb9...
```

The CLI will:
1. Confirm that Developer B's local .gitignore correctly ignores `.env` files.
2. Request the ciphertext associated with `apple-brave-cloud` from the relay server.
3. Once the relay server sends the payload, **the server instantly and permanently deletes (burns) the ciphertext from its database.**
4. Decrypt the payload locally using the encryption key (`50bbfaebb9...`) extracted from the Share Code.
5. Save the environment variables to Developer B's local `.env` file.

*If Developer B already has an existing `.env` file, the CLI will not overwrite it blindly. Instead, it will prompt Developer B to interactively choose whether to keep their local value or overwrite it with Developer A's value for each conflicting key.*

---

## CLI Usage Reference

### Push (Share)
Encrypt and share a local .env file.

```bash
npx env-share-cli-tool push [options]
```

**Options:**
- `--server <url>`: Specify a custom relay server URL.

### Pull (Receive)
Fetch, decrypt, and merge a shared .env file.

```bash
npx env-share-cli-tool pull <share-code> [options]
```

**Options:**
- `--server <url>`: Specify a custom relay server URL.

---

## Security Model

How does env-share guarantee that your secrets are never exposed?

1. **Local Encryption**: When you run `push`, the CLI generates a cryptographically strong, random 256-bit symmetric key and a 96-bit Initialization Vector (IV) in your local memory.
2. **AES-256-GCM**: The contents of your .env file are encrypted using AES-256-GCM, which produces the ciphertext and a 128-bit Authentication Tag for integrity verification.
3. **The Split**:
   - The ciphertext, IV, and Authentication Tag are sent to the relay server.
   - The relay server responds with a temporary 3-word identifier (e.g., `apple-brave-cloud`).
   - The CLI constructs the final Share Code locally: `<identifier>#<hex-key>`.
4. **Decryption**: The receiver's CLI extracts the `<identifier>` to request the payload from the relay, and then uses the `<hex-key>` to decrypt the ciphertext locally.
5. **No Key Transmission**: The 256-bit encryption key is never transmitted to the server in any form. Even if the relay server is compromised, the attacker cannot read your secrets because they do not have the decryption key.

---

## Self-Hosting the Relay Server

By default, the CLI uses a public relay server. For team or enterprise use cases, you can easily self-host the relay server.

The server is extremely lightweight, uses a robust in-memory time-to-live (TTL) cache (no Redis/database configuration required), and enforces rate-limiting (10 requests per minute per IP).

### Setup and Start

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/env-share.git
   cd env-share
   ```

2. Install dependencies and build the server:
   ```bash
   npm install
   npm run build
   ```

3. Start the server workspace:
   ```bash
   npm start --workspace=server
   ```

### Using Your Custom Relay Server

To instruct the CLI to use your custom server instead of the public default, pass the `--server` flag:

```bash
npx env-share-cli-tool push --server https://your-server-url.com
npx env-share-cli-tool pull <share-code> --server https://your-server-url.com
```

---

## License

MIT License.
