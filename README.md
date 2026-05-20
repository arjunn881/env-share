# 🔒 env-share

**An ephemeral, zero-setup CLI tool for developers to securely share `.env` files peer-to-peer.**

Stop copy-pasting your environment variables through Slack, Discord, or iMessage. `env-share` uses end-to-end encryption and a "burn-after-reading" relay server to ensure your secrets stay secret.

---

## ✨ Features

- **Zero-Knowledge E2E Encryption**: Uses AES-256-GCM. The encryption key never leaves your machine and is never sent to the relay server.
- **Burn-After-Reading**: Payloads are instantly and permanently deleted from the relay server the moment they are pulled.
- **Smart Merging**: If the receiver already has a `.env` file, `env-share` interactively prompts you to resolve any conflicting keys (Local vs. Remote) without wiping out your existing setup.
- **Git Guardrails**: The CLI strictly refuses to run unless your project has a `.gitignore` file that actively ignores `.env` files, preventing accidental secret commits.
- **Zero Setup**: Works out of the box via `npx`. No accounts, no logins, no configuration.

---

## 🚀 Usage

You can use `env-share` directly via `npx` in any project directory.

### 📤 Sharing an environment file (Push)

From the project directory containing your `.env` file:

```bash
npx my-env-share-cli push
```

The CLI will:
1. Validate your `.gitignore` to keep you safe.
2. Encrypt your `.env` file locally.
3. Upload the ciphertext to the relay.
4. Output a **Share Code** (e.g., `apple-brave-cloud#50bbfaebb9...`).

Give this share code to your teammate out-of-band. **The code expires in 10 minutes.**

### 📥 Receiving an environment file (Pull)

Your teammate navigates to their local project directory and runs:

```bash
npx my-env-share-cli pull <SHARE_CODE>
```

The CLI will:
1. Verify their `.gitignore`.
2. Fetch the ciphertext and immediately burn it from the relay.
3. Decrypt the payload locally using the hex key inside the share code.
4. If a local `.env` already exists, smartly merge the keys, prompting the user to resolve any conflicts.

---

## 🛡️ Security Model

How does `env-share` guarantee your secrets aren't stolen?

1. **Local Encryption**: When you run `push`, the CLI generates a completely random 256-bit symmetric key and a 96-bit Initialization Vector (IV).
2. **AES-256-GCM**: The `.env` file is encrypted using AES-256-GCM, producing an opaque ciphertext and a 128-bit Authentication Tag.
3. **The Split**: 
   - The `ciphertext`, `IV`, and `Auth Tag` are sent to the relay server.
   - The relay assigns this payload a 3-word phrase (e.g., `apple-brave-cloud`).
   - The CLI appends your local 256-bit key to this phrase: `apple-brave-cloud#<HEX_KEY>`.
4. **Decryption**: The receiver sends `apple-brave-cloud` to the server to get the payload, then uses the `<HEX_KEY>` half of their share code to decrypt and verify the Auth Tag locally. **The server never sees the key.**

---

## 🏗️ Self-Hosting the Relay Server

By default, the CLI uses a public relay server. For enterprise teams, you can easily host the temporary relay server yourself. 

The server is extremely lightweight, uses an in-memory TTL cache (no Redis required), and includes strict rate-limiting (10 req/min/IP).

### Setup

```bash
git clone https://github.com/your-username/env-share.git
cd env-share
npm install
npm run build
npm start --workspace=server
```

### Using a custom server

Once your server is running (e.g., at `https://relay.yourcompany.com`), just pass the `--server` flag to the CLI:

```bash
npx my-env-share-cli push --server https://relay.yourcompany.com
npx my-env-share-cli pull <SHARE_CODE> --server https://relay.yourcompany.com
```

---

## 📜 License

MIT License.
