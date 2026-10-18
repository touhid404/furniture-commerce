# Release verification — 18 October 2026

The React storefront and Express commerce/admin application reuse the reference composition and the existing stack. The current scope is COD only. This report records implementation and local/isolated acceptance; a public merchant deployment is a separate operator step. The supplied compressed video does not establish unseen checkout/admin designs or original merchant assets.

## Implemented features

- Storefront: bounded hero image, contained search controls, consistent spacing with the existing palette, category discovery and shopping guidance sections. Materials, Dimensions and Care are always visible on product details.
- Catalog: server-side global filtering/sorting with a 12-item default, minimal listing payloads, one SQL round trip, pagination metadata, debounced search and URL state.
- Customer experience: skeleton loaders, lazy image loading, public request caching/deduplication, separate route chunks, immediate persistent guest bag and smooth 1.05-second flying-image feedback with reduced-motion support.
- Checkout: login return to checkout, authoritative cart/price/stock review, automatically prepared totals, one Confirm order action, atomic inventory allocation and idempotent order submission. Failure preserves the bag.
- Promotions: server validation before savings are displayed, crossed-out subtotal and discount, quantity/refresh recalculation, expiry/minimum/currency/usage checks, one atomic redemption per successful order. Sample `WELCOME10` is 10% off USD orders with merchandise subtotal at least $100 and maximum 100 redemptions.
- Tracking: signed-in order-number lookup is scoped to the owning account, with fulfillment timeline and shipment information. Legacy private access-token flows remain available.
- Admin: dashboard, product/SKU/price-book/category management, inventory ledger, orders, fulfillment, COD receipts, returns/manual refunds, reviews, promotions, content, media, outbox/audit views and simple persistent Settings. Admin lists have server pagination/search and page-size controls.
- Access: every admin route/method, including nested media, exports and settings, passes shared session/expiry/disabled-user/ADMIN middleware; production profiles require MFA. Customer registration cannot choose a role. Frontend guards redirect normal users before mounting admin children. Admin login/account links go to the dashboard rather than customer orders. The sidebar logo has no Demo badge.
- Confirmation: every admin mutation and admin sign-out prompts before sending a mutation request. Cancel/Escape preserves the record or session. Manual refunds record an operator-paid cash refund and do not transfer funds.

## Database changes and seeds

The owner explicitly approved the one-time production application-data reset. It cleared 25 application tables while preserving schema, constraints, migrations and bootstrap configuration. No later reset was performed. Six reviewed migrations now define 26 separate model/table files, plus the Prisma migrations table. The later `StoreSettings` table preserves validated merchant JSON across restarts; settings use server-generated revisions, optimistic conflict detection and audit records.

The local testing administrator is `admin@ex.com`, username `admin`, password `1234`, role ADMIN. The password is Argon2-hashed and the account requires replacement before production runtime. Both production login and admin authorization reject the flagged weak account. Use the controlled `admin:create` command with a strong password before a real launch. Public demo sign-in is disabled in the active local environment.

`backend/prisma/seeds/products.json` defines 16 realistic sample products, five categories, explicit USD price books, 30 opening units per SKU, sample policies and the demonstration promotion. The seed uses the same product validation/image processing as admin uploads. Its rerun reported `0 created, 16 unchanged`; existing administrator edits, current stock and orders are preserved. It creates no users or fabricated historical orders. The illustrative photographs and descriptions must be replaced with approved merchant product information before selling.

## Image storage

The backend decodes JPEG/PNG/WebP files, enforces a 2 MB input and 40-megapixel decoded limit, rejects invalid/multiframe inputs, and generates a bounded 480px WebP card derivative. UUID object keys prevent collisions. Original and derivative files live in the branch's private Neon `assets` bucket, persist independently of backend restarts and are served through stable `/media/<id>` URLs with expiring S3 download redirects. Database rows contain paths/object keys rather than image binaries or signed URLs.

Admin editing supports image replacement. In-use assets cannot be deleted. Removing unused assets queues original and derivative deletion for the worker. Listing cards request the smaller derivative; product detail views retain originals. No transient local upload directory is required by this configured storage deployment.

## Performance measurements

Single local desktop Chrome samples used Vite, the same remote Neon region and the supplied measurement script. These are diagnostic observations, not field percentiles or a hosting SLA. Network/cold-start variation applies.

| Measurement | Before | Final local sample |
| --- | --- | --- |
| Products visible | 30,519 ms | 3,618 ms |
| Initial API requests | 11 | 4 |
| Add-to-cart visible update | 10,905 ms | 93 ms |
| Cart API requests during add | 1 | 0 |
| Product API samples | 4,796 / 2,265 / 3,895 ms | 291 / 291 / 290 ms |
| LCP observation | 27,000 ms | 3,064 ms |
| CLS observation | 0.03783 | 0.00006 |
| Interaction-duration approximation | 48 ms | 64 ms |

Main bottlenecks were session/cart bootstrapping, multiple round trips/overfetching, full-resolution listing photos and backend-dependent cart actions. Public GETs avoid session lookups; filtered catalog pages use one SQL query. Existing category/status and unique variant/price indexes are retained. Large-dataset query plans and production search indexing should be evaluated with the real merchant catalog; this 16-product sample does not establish scale capacity. The final LCP sample is above the 2.5-second target, and the interaction approximation did not improve; measure field LCP/INP after hosting, font/CDN and merchant-image setup. The local interaction remains responsive and no artificial delay is added to cart state.

## Guest cart and checkout

The versioned local-storage bag combines duplicate variants and handles quantities, removal, subtotal, badge, refresh and cross-tab updates without cart requests. Market switching fetches actual price-book entries; it never converts arbitrary prices. Animation clones visual content using transform/opacity and never moves the source card or blocks cart state.

Checkout requires a customer session and restores the bag after login. The server accepts identifiers/quantities and independently calculates prices, discounts, delivery, tax and purchasability. Changed prices/stock are shown for renewed review. Quotes bind cart/config revisions and expire. Serializable transactions, stock constraints, movement keys and idempotency keys prevent overselling/double orders. Only successfully purchased quantities clear after success; failures preserve selections.

## Neon branch state

The application remains on `production` (`br-cold-star-b5kydlky`) in project `quiet-boat-96833475`, using the matching private assets bucket. Only the root ignored `.env.local` holds local application secrets. No production fixtures were run. Acceptance uses temporary `test-commerce-20261018`, with credentials injected from a file outside the repository; the runner also rejects the production endpoint when its label is incorrect.

A fresh Neon inspection lists only `production` and the temporary test branch; the old `dev-commerce-platform` is no longer present. No existing branch was deleted by this implementation. The owner retained responsibility for development-branch cleanup. The temporary test branch expires at 10:00 UTC on 19 October; after expiry only production remains.

## Project cleanup

The unused `@neon/env` dependency and obsolete consolidation helper were removed. Unused imports are checked with TypeScript. Old fabricated order seeding was replaced by the dedicated real-image catalog seed. Existing shared components, migrations, compatibility seed entry point and operational features were retained. Local video/analysis frames, screenshots, render previews, generated clients, dependencies, secrets and runtime artifacts remain ignored. Approved product objects reside in Neon rather than Git.

## Validation record

- Build, TypeScript unused-code/format checks, JSON schema/cross-field checks, Prisma schema and OpenAPI/local-link validation passed. A clean checkout without environment credentials also generated Prisma, passed lint and passed all 21 units. Production dependency audit reported zero vulnerabilities.
- Unit tests: 21 passed, including exact money, cart ownership, transaction retries, origin/reset guards, image decoding, local cart, promotion rules and middleware failures.
- Admin API acceptance: 2 passed. All 44 route/method pairs rejected both guests and authenticated customers; pagination and settings persistence/conflicts were verified on isolated Neon.
- Promotion/tracking API acceptance: 1 passed, including no preview redemption, authoritative totals, idempotent single redemption and private order lookup.
- Full real Neon commerce/security acceptance: 7 tests passed in 364 seconds, including overselling/idempotency races, stale stock versions, cancellation versus shipment, COD accounting, refund limits, MFA/recovery and actual S3 byte/link integrity.
- Browser release suite: 7 tests passed in 4.1 minutes. Follow-up admin access/confirmation/badge and empty-proxy recovery checks: 2 passed in 44.5 seconds. Together these cover eight distinct browser scenarios, including always-visible specifications and immediate inventory adjustment counts.
- SMTP/outbox worker: 1 test passed in 48 seconds; 27 messages were accepted by a local SMTP receiver, without sending external email. Expired final leases reached the failed/dead-letter state.
- Settings persistence was rerun after the deployment-override refinement and passed. `npm run config:apply` was verified in its read-only dry-run mode; it did not publish configuration.
- Production connectivity after the additive settings migration: pooled `SELECT 1` passed; read-only transaction returned `42`; 27 public tables found. No verification writes were made by that command.

The first remote run caught lint executing before client generation. CI now generates the ignored Prisma client first, and pure authorization/error modules no longer initialize the database in unit tests. GitHub actions use verified Node 24 runtimes. Resolved issues included an old API process returning an unimplemented endpoint, local Vite origin rejection, raw serialization retry handling, hero/search overflow, weak skeleton states and checkout's previous two-button flow. Empty proxy 502 responses during development API restarts previously surfaced raw JSON parser errors. The client now validates empty/non-JSON responses, retries safe reads once, never automatically retries writes, and explains ambiguous write status. Generated Prisma files are excluded from the dev watcher. Inventory adjustments return the committed row/version and update visible quantities directly without waiting for another list request. An overlapping test originally changed shared sample stock between quote and order; promotion acceptance now uses its own product fixture. A pg8/Prisma driver deprecation warning was observed during concurrency stress; it did not fail the completed checks and should be reviewed before a future pg9 upgrade.

## Environment and commands

Use Node 24, `npm ci`, one root `.env.local`, reviewed `npm run db:deploy`, idempotent `npm run seed`, then `npm run dev` for Express 3001 and React 5173. `npm run build` followed by `npm start` runs the compiled app, with strong admin credentials required for production runtime. `npm run worker` handles outbox/storage cleanup. Database and object-storage credentials must belong to the same Neon branch. Sharp is the added image-processing dependency. `config/README.md` explains editable variables, and `npm run config:apply` defaults to read-only validation; publishing requires `--apply --expected-revision` and an active administrator.

Run credential-free checks with `npm run lint`, `npm test`, `npm run build`, `npm run check:config`, `npm run check:docs` and `npm run prisma:validate`. Live fixture commands must use `scripts/run-isolated.mjs` and a deliberately created temporary `test-*` branch, as documented in the operator guide. Never run the destructive reset or fixture suites in normal production deployment.

## Git and launch handoff

Implementation is maintained on `feat/commerce-platform` and [PR 6](https://github.com/touhid404/furniture-commerce/pull/6). Main is protected by the required `validate` check, without force pushes or history rewriting. The verified implementation milestone is `684af81` (optimize commerce and secure administrator workflows), committed and pushed before the documentation handoff. The PR and final response record the resulting protected-main merge SHA and CI result. Analysis images and credentials are excluded from commits.

The code does not provision a public application host, domain/HTTPS, live SMTP provider, merchant shipping/tax compliance or a paid payment adapter. The Dockerfile is provided but the container image was not built here because Docker is unavailable. Use approved merchant policies/assets, strong admin credentials/MFA, production secrets, monitoring/backups and deployment recovery procedures before taking real orders. Online payments remain coming soon as requested.
