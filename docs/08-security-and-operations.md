# Security deployment and operations

## Identity and permissions

Hash passwords with a maintained Argon2id implementation and calibrated cost; never encrypt passwords reversibly. Rate-limit login, reset, signup, guest access and checkout by identity and IP. Rotate opaque session tokens on authentication; store hashes server-side and enforce absolute and idle expiry. Production admin accounts should require MFA before financial operations; choose and implement the MFA flow before production release. Record privileged events without logging credentials or full payment payloads.

Authorize every admin operation and every order/address access in Express. React route guards improve navigation only. Prevent customers from updating role, payment state, totals or inventory. Escape output, sanitize permitted rich content and validate uploads. Use TLS, security headers, request-size limits, trusted origins and CSRF tokens. Restrict CORS to explicit origins and configure proxy trust for the actual gateway. Express's [production security guidance](https://expressjs.com/en/advanced/best-practice-security/) covers baseline hardening; the commerce-specific permissions here remain project requirements.

Demo sign-in and simulated shoppers exist only in an isolated demo deployment with fake data, restricted writes and no live payment keys. Production configuration rejects demo mode. Do not reproduce the video's browser-stored admin authentication as a production implementation.

## Secrets and payment handling

Database URLs, session secrets, signing keys and provider secrets belong in deployment secret stores and ignored local environment files. Browser bundles receive only public configuration. Use hosted card collection, verified webhooks, idempotency and server-side amount/currency checks. Signature verification depends on the selected provider's documented raw-body scheme. Keep test/live credentials separate. Never print database passwords in test reports.

Allow JPEG, PNG and WebP product uploads with bounded byte size and dimensions; validate actual signatures and reject active content. Generate safe derivative sizes. Do not fetch arbitrary user-controlled remote URLs through the backend. Store assets in object storage, serve through a CDN and authorize presigned upload creation. Audit CSV exports and protect against spreadsheet formula injection.

## Neon and Prisma setup

The user supplied organization `org-summer-unit-14920623`, project `quiet-boat-96833475`, branch `production`, and the Postgres service. Use the Neon CLI to link and reconcile that exact target, keep generated local link state ignored where it contains machine-specific metadata, and inspect `neon.ts` before deployment. `neon deploy` provisions declared backend services; it does not by itself publish the React and Express applications.

For a long-running Node/Express service, the runtime adapter choice must follow the installed Neon skill. Keep the pooled runtime URL separate from the direct migration URL. Read `.env.local` explicitly in Node tools if the CLI writes it there; plain dotenv defaults do not automatically load it. Never copy database URLs into `VITE_` variables. Neon's [Prisma integration guide](https://neon.com/docs/guides/prisma) documents the paired connection-string approach; final adapter/version choices are recorded in the setup report.

Before schema changes, inspect whether the supplied production branch already has application tables. A connectivity test can use SELECT and a transaction rolled back afterward. New commerce migrations need reviewed SQL and an isolated development branch; production reset or destructive schema push is never a routine setup step. Use `prisma migrate deploy` for reviewed production migrations, and development migration generation only against disposable development branches.

## Environment and deployment plan

Maintain local, test, staging and production environments with separate databases, origins, provider keys and media prefixes. CI validates contracts, configuration, types, build and meaningful tests. A deployment builds immutable artifacts, applies compatible migrations in a controlled job, deploys API and worker, deploys frontend assets, then runs smoke checks. Roll back application artifacts first when possible; prefer a forward database fix after a migration rather than an untested reverse migration.

At launch, host React assets behind a CDN and Express plus workers on a Node runtime suited to their lifecycle. A provider is not yet selected. Align backend region with Neon to reduce latency. Add a real transactional email provider and object storage before catalog operations depend on them. DNS, email domains, sender verification and gateway URLs are owner inputs. The current Neon task provisions only Postgres.

Liveness checks process health; readiness checks required dependencies with timeouts and returns no credentials. Restrict detailed diagnostics to authenticated operations. Graceful shutdown stops accepting requests, lets in-flight work finish, releases worker leases and disconnects Prisma.

## Monitoring recovery and support

Structured logs carry request ID, route, result, latency and permitted actor references. Redact authorization headers, cookies, payment tokens, full addresses and database URLs. Track request failures, DB connection errors, payment webhook delays, stock exceptions, failed jobs, refund failures and stale dashboard data. Configure an alert destination and an owner before launch; no notification account is assumed.

Document backup coverage for the actual Neon plan, test a restore into a separate branch/environment, and record achieved recovery time and data loss. A backup setting without a successful restoration is insufficient. The proposed four-hour recovery and 24-hour data-loss targets need a verified plan. Versioned assets and configuration revisions are part of recovery.

Operational runbooks must cover provider outage, duplicate webhook, payment received without stock, failed COD delivery, failed refund, lost admin session, compromised credential rotation, failed migration and customer data request. Give each incident an owner, containment step, recovery action and evidence record. Business retention and privacy text depend on the chosen country and are not supplied by the demo.
