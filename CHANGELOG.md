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

Implementation remains in progress. The complete reference frontend and full commerce integration/browser acceptance are pending. Backend compilation and targeted unit tests do not establish production readiness.

### Commerce implementation milestone

- Implemented reference-inspired React storefront, customer account/checkout/orders and responsive admin screens.
- Added Neon Object Storage uploads, stable product image URLs and media integrity constraints.
- Added market price books, SKU controls, content publication, promotion/review management, inventory and order operations.
- Added actual receipt/refund-time dashboard accounting and raw PostgreSQL serialization retry handling.
- Added API, browser, upload, SMTP-worker and accessibility acceptance checks; final release results are recorded separately.
- Added crawlable catalog/product metadata, sitemap/robots and a container deployment/operator guide.
