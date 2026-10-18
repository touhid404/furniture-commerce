# Neon setup and verification report

## Result

On 18 October 2026, the React and Express foundation was connected to the user-selected Neon PostgreSQL service through Prisma. The compiled application starts, configuration checks pass, a live read-only database test passes, and a real browser verifies the React to Express to Prisma to Neon to rendered-response flow. The commerce storefront, authentication, admin operations and checkout remain future implementation phases.

Target organization is `org-summer-unit-14920623`, project `quiet-boat-96833475`, branch `production`. Only Postgres was requested and provisioned/reconciled. No Auth, storage, AI Gateway or Function service was enabled. No application schema was created or changed.

## Setup commands and outcomes

The requested `npm i -g neon@latest` failed with EACCES for `/usr/local/lib/node_modules/neon`. The authorized fallback `npx --yes neon@latest` succeeded. Initialization used the exact requested organization, project and branch flags. The CLI wrote its link offline, installed Neon agent tooling and created `neon.ts` with no extra services. The missing Copilot executable produced a tooling warning; it did not block Postgres setup.

`npx --yes neon@latest deploy` requested browser sign-in. After authentication it reported:

```text
Auth complete (profile DEFAULT)
Applying to branch production (br-cold-star-b5kydlky)
No changes — branch production already matches the policy.
Utilized services: Postgres
Pulled 3 Neon variables into .env.local
Postgres DATABASE_URL, DATABASE_URL_UNPOOLED
Branch NEON_BRANCH
```

Environment values are intentionally omitted. `.env.local` and `.neon` are ignored by Git. The app loads `.env.local` before `.env`, while deployment-injected variables take precedence. Runtime uses the pooled URL; Prisma CLI configuration points to the direct URL. `@prisma/adapter-pg` and `pg` suit the long-running Node/Express process. Neon URL certificate verification is set explicitly to verify-full in memory without rewriting the local credential file.

## Application changes

Added a TypeScript React/Vite setup page, an Express API, Prisma 7.10.1 with the pg adapter, an environment loader, validated JSON profiles and a public configuration allowlist. Added `/api/v1/config`, `/api/v1/health/live` and `/api/v1/health/ready`. Unknown API routes return JSON 404. The production build serves the React bundle from Express. The server binds to localhost for this development foundation.

The Prisma schema contains only generator and datasource declarations. It generates a client for raw, parameterized connectivity queries and has no commerce models or migrations yet. The real database inspection found zero public application tables. No schema push, migration, seed or persistent test write was run.

## Verification evidence

The successful `npm run build` generated the Prisma client, passed TypeScript checking, built Vite assets and compiled the backend. Vite 8.3.4 reported 15 modules transformed and a completed production bundle. The backend then started with:

```text
Commerce API listening on http://127.0.0.1:3001
```

`npm run prisma:validate` reported the schema valid. `npm run check:config` reported:

```text
PASS store JSON schema and cross-field validation (furniture-demo, 2026-10-18.1)
PASS public configuration allowlist
```

`npm test` passed six checks covering reusable owner/currency settings, unknown currency rejection, unsafe navigation rejection, production demo rejection, unknown secret-shaped fields and the public allowlist.

`npm run test:db` reported:

```text
PASS Prisma -> Neon pooled PostgreSQL SELECT 1
PASS Prisma read-only transaction result = 42
INFO public application tables found: 0; no schema changes performed
```

`PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` reported:

```text
React -> Express -> Prisma -> Neon connection and JSON branding
1 passed (6.2s)
```

This browser test checks configured branding, actual Connected status, retry, 390-pixel layout without horizontal overflow and JSON 404 for an absent API. It uses a real Chrome process and the compiled server with the live database. Screenshots remain local and are excluded from GitHub.

A direct GET to readiness returned `status: ready`, `database.status: connected`, a UTC server timestamp and observed latency of 1778 ms for that request. Liveness returned `status: ok`. This one latency observation is not a performance benchmark.

## Problems encountered and resolution

Global install permission failure was handled with npx. Initial TypeScript errors for CSS imports and an overly narrow sample-currency type were corrected. The first compiled server start failed because Prisma generated extensionless internal imports; specifying ESM output and `.js` import extensions fixed the runtime. The build and server were rerun successfully. A pg TLS alias deprecation was resolved by explicit certificate verification.

A Playwright Chromium download was slow and was stopped; the installed Google Chrome was used for the passing test. The connected GitHub plugin could not see the newly created private repository and returned 404; normal authenticated Git push works. Repository operations use available authenticated access without changing connector permissions.

## Remaining work

Implement the documented commerce and admin features through scoped PRs. Choose launch-market details and payment/shipping providers; supply original design assets; create an isolated development database branch; add reviewed commerce migrations; and complete release acceptance. `neon deploy` configured backend services and environment variables; the web application has not been published to a public hosting service.
