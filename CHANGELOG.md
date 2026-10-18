# Changelog

## Unreleased

- Added timestamped furniture storefront and admin design specification.
- Added production commerce requirements, data design, API inventory and acceptance plan.
- Added reusable JSON store profiles, schema validation and public configuration allowlist.
- Added a React and Express connectivity foundation with Prisma and Neon PostgreSQL.
- Added private GitHub workflow templates and CI checks.

- Organized the application into root `frontend/` and `backend/` workspaces.
- Added one Prisma schema file per table and an initial SQL migration with stock and money constraints.
- Added backend modules for sessions, catalog, carts, COD checkout, fulfillment, returns and admin operations, plus an email outbox worker and fictional demo seed.
- Added exact-money, CSV export and cart-ownership unit coverage.
- Deferred SSLCommerz; cash on delivery is the only active checkout method.

Release verification and the operator guide record full-stack acceptance and the remaining merchant/hosting setup.

### Commerce implementation milestone

- Implemented reference-inspired React storefront, customer account/checkout/orders and responsive admin screens.
- Added Neon Object Storage uploads, stable product image URLs and media integrity constraints.
- Added market price books, SKU controls, content publication, promotion/review management, inventory and order operations.
- Added actual receipt/refund-time dashboard accounting and raw PostgreSQL serialization retry handling.
- Added API, browser, upload, SMTP-worker and accessibility acceptance checks; final release results are recorded separately.
- Added crawlable catalog/product metadata, sitemap/robots and a container deployment/operator guide.

### Performance, catalog and local bag milestone

- Selected the existing Neon production branch; performed the owner's explicitly approved one-time application-data reset while retaining schema/migrations. Development-branch deletion remains with the owner.
- Added a dedicated idempotent 16-product seed with real photographs, explicit price books and stock ledger entries; removed invented historical order seeding.
- Added username login and a production-blocked weak local admin account, guarded reset tooling and isolated fixture execution.
- Added decoded/size-limited image validation and 480px WebP derivatives to the shared upload/seed workflow.
- Replaced catalog overfetching with one paginated listing query, a 12-product default, public request caching/deduplication and debounced search.
- Added instant persistent local bags, authenticated server revalidation and smooth 1.05-second fly-to-bag motion.
- Replaced spinners with content skeletons, refined spacing without changing the palette, added two landing sections and fixed hero/search containment.
- Removed the unused `@neon/env` dependency and obsolete data-consolidation helper.

- Added immediate validated promotion savings, expired/minimum/currency/usage-limit handling and atomic single redemption.
- Added automatic checkout total preparation with one Confirm order action, and account-scoped order-number tracking.

### Administrator experience and authorization

- Centralized session, expiry, disabled-account, ADMIN role, password and production MFA checks in router-wide middleware, covering every admin API including media and exports.
- Redirected administrators to the dashboard after login and away from the customer account page.
- Added paginated/searchable admin lists with page-size controls and persistent URL state.
- Added confirmation dialogs before admin mutations and logout; cancelling sends no mutation request.
- Added a simple Settings form backed by validated, persistent JSON revisions in `StoreSettings`, optimistic concurrency and audit events. Deployment/security flags remain server-controlled.

- Made product Materials, Dimensions and Care always visible with semantic definition lists.
- Returned committed inventory rows/versions after adjustments and updated visible quantities immediately.
- Added controlled empty/non-JSON API response handling, a safe read retry and no automatic mutation retry. Excluded generated Prisma files from the development watcher.

- Added `config/README.md` beside store JSON profiles, plus a read-only-by-default, revision-checked operator configuration publishing command. Removed the admin logo Demo badge.
