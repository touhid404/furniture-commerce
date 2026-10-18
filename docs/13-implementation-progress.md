# Implementation progress — 18 October 2026

This document records the current implementation milestone. The earlier specification and Word document are a planning snapshot; the latest owner instructions take precedence: root `frontend/` and `backend/` folders, one Prisma model file per table, COD-only checkout, and merge into main only after the complete project passes acceptance.

## Included in this milestone

- npm workspaces for the React frontend and Express backend.
- Twenty-four separate Prisma model files, shared enums and a generator/datasource file.
- Initial SQL migration with nonnegative inventory, allocation, quantity and monetary constraints.
- Express modules for opaque sessions, CSRF, password hashing, account operations, MFA enrollment, public catalog, server-owned carts, price quotes, idempotent COD orders, fulfillment, returns, manual refunds and admin operations.
- Transactional email outbox, separate SMTP worker, admin creation command and explicitly guarded fictional demo data.
- JSON storefront settings and a safe public checkout configuration; online payment is labeled coming soon.
- Integer money calculations, CSV escaping and regression checks for guest/account cart ownership.

## Database isolation

The local development branch is `dev-commerce-platform` in the authorized Neon project. The migration and demo seed were applied only to that branch. The previously selected production branch was preserved. Environment files, branch metadata and credentials remain ignored.

A fresh checkout must select a deliberate development database and pull its ignored environment before migrations. Do not copy the fictional demo seed into a production store.

## Verification completed

- `npm test`: 11 tests passed, 0 failed.
- `npm run build`: Prisma generation, TypeScript checking, Vite bundle and Express compilation passed.
- `npm run check:config`: JSON schema, cross-field checks and public allowlist passed.
- `npm run check:docs`: local links, JSON profiles and scoped OpenAPI references passed.
- `npm run prisma:validate`: all modular schema files validated.
- `npm run test:db`: pooled PostgreSQL probe and read-only transaction passed.
- `npm run db:seed`: completed with 9 products and 5 categories plus explicitly fictional admin and order records on the development branch.

## Still pending before release or merge

The reference storefront, customer workflows and admin screens are not complete. Full API transaction/concurrency acceptance and full commerce browser tests remain pending. The existing browser test covers only the connectivity foundation. The OpenAPI document is still a scoped planning contract and must be reconciled with all implemented routes. Product media management and deployment operations need completion. SMTP must be configured to prove real email delivery. SSLCommerz is deferred by the owner.

A successful build and these targeted unit checks do not establish production readiness. Keep the feature pull request in draft and leave main unmerged until the complete project is verified.
