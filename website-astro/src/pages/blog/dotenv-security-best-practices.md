---
layout: ../../layouts/BlogPost.astro
title: "9 .env Security Best Practices Every Developer Should Know"
description: "How to handle .env files safely: gitignore rules, encryption, secret rotation, and why sharing via chat is dangerous."
date: "2024-12-01"
readTime: "6 min read"
tags: ["Security", ".env", "Best Practices"]
---

Every web developer uses `.env` files. Almost no one handles them correctly.

`.env` files hold database passwords, API keys, JWT secrets, and payment provider credentials. A single leaked `.env` can compromise your entire production environment, expose user data, and rack up thousands of dollars in cloud bills overnight. Yet most teams still share secrets by copying them into a Slack DM.

This guide covers nine practices that will harden your `.env` workflow from development through production.

---

## 1. Always Add .env to .gitignore — All Variants

This is the most common mistake. Developers add `.env` but forget about `.env.local`, `.env.production`, or `.env.staging`.

```
# Your .gitignore should contain all of these
.env
.env.*
.env*.local
```

If any variant of your `.env` file has ever been committed to git — even if you deleted it later — you must rotate every secret in it. Git history is permanent.

**Verify right now:** run `git log --all -- .env` in your project. If it returns results, rotate your secrets.

---

## 2. Never Share Secrets in Plain Text

The most dangerous "workflow" in software development: copying a `.env` file and pasting it into Slack, Discord, email, or a Jira comment.

The risks:
- **Permanently logged.** Slack stores messages indefinitely. Anyone with workspace access — including administrators and future employees — can search and find your secrets.
- **No expiry.** Unlike a time-limited link, that Slack message exists until someone manually deletes it.
- **Breach multiplier.** If your Slack workspace is breached, every secret ever shared there is compromised.

**Instead:** Use a tool designed for this. `share-env` encrypts the payload with AES-256-GCM before it leaves your machine and burns the secret after a single read. The relay server never sees the decryption key.

```bash
# Sender
npx share-env push

# Share the code (e.g. apple-brave-cloud#a3f9b2c1...)
# via Slack, Signal — code is useless without the key prefix

# Receiver
npx share-env pull apple-brave-cloud#a3f9b2c1...
```

---

## 3. Use Separate .env Files Per Environment

Do not use a single `.env` for development, staging, and production. Separate files enforce the principle of least privilege and prevent development credentials from accessing production data.

```
.env                # local development (low-privilege)
.env.staging        # staging environment (medium-privilege)
.env.production     # production (high-privilege, deployed via CI/CD)
```

Production secrets should **never** be on a developer's laptop. They should be injected exclusively through your CI/CD pipeline (GitHub Actions secrets, Vercel environment variables, AWS Secrets Manager, etc.).

---

## 4. Validate Environment Variables at Startup

If your app starts with missing or malformed environment variables, it will fail in confusing ways — often only when a specific code path is hit in production.

Use a library like [`envalid`](https://www.npmjs.com/package/envalid) or [`zod`](https://zod.dev/) to validate your environment at boot:

```javascript
// env.js (load this first in your app entry point)
import { cleanEnv, str, url, num } from 'envalid';

export const env = cleanEnv(process.env, {
  DATABASE_URL: url(),
  API_KEY:      str({ minLength: 32 }),
  PORT:         num({ default: 3000 }),
  NODE_ENV:     str({ choices: ['development', 'production', 'test'] }),
});
```

If a required variable is missing, the app crashes immediately with a clear error message — not three days later in production.

---

## 5. Rotate Secrets Regularly and After Personnel Changes

Treat secrets like passwords. Rotate them:
- Every 90 days at minimum
- Immediately when a team member leaves
- Immediately after any suspected breach
- After any system compromise, even unrelated ones

Most services (Stripe, GitHub, AWS) let you generate new keys without downtime. Rotate the key, update your deployment, verify it works, then revoke the old key.

---

## 6. Use a Secrets Manager for Production

`.env` files are a development convenience. In production, use a proper secrets manager:

| Platform | Secrets Manager |
|---|---|
| AWS | Secrets Manager / Parameter Store |
| Google Cloud | Secret Manager |
| Azure | Key Vault |
| Vercel | Environment Variables (encrypted at rest) |
| Kubernetes | Secrets (or Sealed Secrets / Vault) |

These systems provide audit logs, granular access control, and automatic rotation — none of which a `.env` file can offer.

---

## 7. Never Log Environment Variables

Application logs often end up in Datadog, Papertrail, or CloudWatch — accessible to many people. A single `console.log(process.env)` in a debug session that makes it to production can expose every secret your app uses.

Use a linter or pre-commit hook to prevent this:

```bash
# Install a lint rule to catch this pattern
npm install --save-dev eslint-plugin-no-secrets
```

Audit your existing logs for accidental secret exposure.

---

## 8. Set File Permissions on .env Files

On Linux and macOS, set strict permissions so only your user account can read the file:

```bash
chmod 600 .env
```

This prevents other users on shared systems or compromised processes from reading your local secrets. On CI systems, verify that `.env` files are not world-readable.

---

## 9. Audit Third-Party Packages That Access Process.env

Every package your project installs can technically read `process.env`. This is a vector for supply chain attacks — a compromised npm package reads your secrets and exfiltrates them.

Mitigations:
- Pin exact package versions in `package-lock.json` and commit it
- Use `npm audit` regularly and act on critical findings
- Consider tools like [Socket.dev](https://socket.dev/) for supply chain monitoring
- Limit what's in `process.env` to what each service actually needs

---

## Summary

| Practice | Priority |
|---|---|
| .gitignore all .env variants | Critical |
| Never share in plain text | Critical |
| Separate env per environment | High |
| Validate at startup | High |
| Rotate after changes | High |
| Use secrets manager in prod | High |
| Never log env vars | Medium |
| Set file permissions (600) | Medium |
| Audit third-party access | Medium |

Your `.env` file is as sensitive as your production database password — because it contains it. Treat it accordingly.
