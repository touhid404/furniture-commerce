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
