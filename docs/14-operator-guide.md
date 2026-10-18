# Store operator and deployment guide

## Application boundaries

`frontend/` contains the React storefront and admin routes. `backend/` contains Express, Prisma models, migrations, administration and the worker. The browser uses the same origin for `/api/v1` and the application. PostgreSQL and the private `assets` bucket are on the selected Neon branch. Each table has its own file in `backend/prisma/schema/models/`; the main Prisma file contains generator and datasource only.

The active payment method is cash on delivery. The online payment panel says coming soon. SSLCommerz is intentionally deferred. Refund actions record an already completed manual payout; they do not transfer money.

## One local environment file

Keep all local credentials and server settings in the ignored root `.env.local`. Deployment-injected environment variables take priority. Start from the [credential-free environment template](config/backend.env.example). The database and storage endpoint must belong to the same branch. `neon.ts` declares the private `assets` bucket.

Required: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, a long random `SESSION_SECRET`, a 64-hex-character `MFA_ENCRYPTION_KEY`, and the intended `PUBLIC_APP_URL`. `STORAGE_BUCKET` defaults to `assets`. `STORE_CONFIG_PATH` defaults to `config/stores/default.json`.

For email, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM`. Without SMTP, email jobs remain queued and the worker still processes storage cleanup. Do not promise customers email delivery until a real provider is configured and checked.

## Start and operate

1. Use Node 24 and run `npm ci`.
2. Check the intended Neon branch before running `npm run db:deploy`. Migration deployment is explicit; startup never resets or pushes a schema.
3. Run `npm run build` and `npm start`. The app defaults to `http://127.0.0.1:3001`. For development hot reload use `npm run dev` and port 5173.
4. Run the worker separately: `node dist/server/backend/src/worker.js` after build, or `npm run worker` while developing. Supervise the API and worker independently and restart them on failure.
5. Set `REQUEST_LOGS=true` for structured method/path/status/latency logs. Request IDs are returned to callers. Do not log cookies, credentials, signed URLs or email token fragments.

## Demo and real-store configuration

The repository's default profile is an explicitly labeled demo using fictional catalog and historical order records. `DEMO_SEED=true npm run db:seed` is permitted only with the demo profile. It preserves existing product edits on reruns. Production branch naming does not change a demo profile into a real merchant launch.

For a real store, create a reviewed JSON profile with `mode: production`, disable `features.demoAdmin` and `features.simulateTraffic`, set actual country/currency/locale, explicit price books, supported shipping rates, COD caps, tax rules, policies and brand details. Keep personal and country-specific variables in JSON. Never place access keys in that profile. Run `npm run check:config` before deployment.

Create a real administrator using the controlled `npm run admin:create` command with `ADMIN_EMAIL` and `ADMIN_PASSWORD` supplied securely in the process environment. Public registration always creates a customer. Sign in and enroll an authenticator at `/account/security`; production admin operations require a session that has passed MFA. Keep the encryption key stable across deployments and store it in the hosting secret manager. Lost authenticators require an authenticated operator recovery procedure; do not add a public bypass.

## Everyday administration

- Products: create drafts, set category/SKU/market price/stock, upload a JPEG/PNG/WebP of at most 2 MB directly in the product form, then publish. Extra finishes have separate SKUs. Inventory shows physical on-hand, allocated and available balances; adjustments require a reason and version check.
- Images: the server checks image signatures and writes immutable object keys into Neon `assets`. PostgreSQL stores the key and a stable `/media/:id` URL. Reads generate a fresh one-hour signed URL; expired signed URLs are never saved as product references. In-use images cannot be deleted. Deletion is queued to the worker after the reference is removed.
- Orders: process, dispatch with carrier/tracking, confirm delivery, then record the actual cash collection. Order creation does not mark cash as paid. Export CSV from the orders screen.
- Returns: review a request, approve/reject with instructions, receive and inspect goods, and choose whether to restock. Record any completed manual payout separately on the order page. Duplicate receipts and excess refunds are rejected.
- Storefront: save content drafts, publish when ready, or restore an earlier revision by publishing it. Rendering is plain text. Store variables remain reviewed JSON changes in GitHub.
- Reviews: publish or hide reviews from verified delivered purchases. Notifications show pending/sent/failed outbox jobs; failed jobs can be retried. The audit screen records privileged changes.

## Revenue and inventory definitions

Revenue follows `COD_COLLECTED` event time and successful manual refund records, excluding the proportion attributable to tax and shipping. Orders, average order value and purchasing identities follow order creation time. Dashboard requests use one currency and the configured timezone. No random shopper traffic is simulated.

An order atomically allocates stock. Dispatch decreases both physical stock and allocation. Cancellation before dispatch releases allocation. Accepted returns can increase physical stock once. Financial refunds do not themselves restock goods. Server-side integer minor units govern every total; the browser never supplies an authoritative price.

## Deployment

The repository supplies a multi-stage Dockerfile. Build the `build` target for a separate reviewed migration job, then deploy the default runtime target behind HTTPS. Supply environment variables through the host secret manager. Run the API on port 3001 and set `PUBLIC_APP_URL` to the public HTTPS origin. Run a second instance/process using `node dist/server/backend/src/worker.js` for the worker. Neon hosts the database and objects, while the React/Express process requires an application host.

Use `/api/v1/health/live` for process liveness and `/api/v1/health/ready` for database readiness. Product HTML includes server-rendered catalog content and metadata before React starts; `/robots.txt` excludes private areas and `/sitemap.xml` lists public content. Configure a CDN for static bundles and product images as traffic grows; do not cache authenticated API responses.

A live deployment still requires a host, domain/HTTPS, real merchant policies and catalog, SMTP credentials, and an operating owner. These external choices are not created by merging code.

## Verification and recovery

Run `npm test`, `npm run build`, `npm run format:check`, `npm run check:config`, `npm run check:docs`, and `npm run prisma:validate`. Real database integration, worker and browser tests create fixtures and must use an isolated demo branch, never the production branch. The integration runner rejects `NEON_BRANCH=production`. Do not put production credentials into untrusted GitHub PR jobs.

Before a risky migration, create a Neon recovery branch at the intended restore point, verify schema and critical row counts, and test the app against it. Storage branches with the rows. Preserve the prior app image and profile revision; application rollback must remain compatible with the migrated schema. Never reset production. Establish retention, recovery point/time targets and an operator runbook for the selected Neon plan before real customer launch.

Production data deletion and retention need a reviewed merchant policy. Sessions and orders are related for audit and guest access; do not delete historical session records indiscriminately. Database migrations and immutable order snapshots preserve financial history.
