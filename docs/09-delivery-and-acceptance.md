# Delivery plan and acceptance

> Current release scope: cash on delivery is active; SSLCommerz and card/webhook scenarios are deferred by the owner. Frontend and backend implementations live in `frontend/` and `backend/`. The 81-operation OpenAPI inventory and implementation/operator guides reflect current routes; card-provider sections below describe a future extension.

## Phases and dependencies

| Phase | Deliverables | Completion evidence |
| --- | --- | --- |
| 0 Documentation and setup | Reference audit, requirements, contracts, JSON profile, private repository, Neon connection | Validated artifacts and setup report |
| 1 Application foundation | React apps, Express, Prisma, sessions, CI and config loader | Build and Postgres integration checks |
| 2 Reference storefront | Header, bento hero, catalog and sign-in | Visual comparisons to V01 to V03 |
| 3 Commerce | Product details, bag, pricing, quotes, stock, card and COD orders | Concurrent/retry and provider sandbox tests |
| 4 Admin operations | Reference dashboard, catalog, categories, inventory, orders and content | Role checks and real-data dashboard comparison |
| 5 After purchase | Shipment, guest order access, cancellation, returns, refunds and email | End-to-end lifecycle tests |
| 6 Release | Accessibility, performance, security review, backups and deployment | Launch checklist and restore rehearsal |

Phases are dependency ordering, not promised calendar estimates. The Neon foundation request does not mean all commerce phases have been implemented. Each feature is delivered through a focused branch and reviewed pull request; requirements and contracts change in the same PR as behavior.

## Traceability matrix

| Requirement | Implementation areas | Required verification |
| --- | --- | --- |
| R01 reference fidelity | Shared UI, home, catalog, auth, admin | Four screenshot comparisons |
| R02 two experiences | Session roles and admin routes | Customer denied every admin mutation |
| R03 requested stack | React, Express, Prisma/Postgres | Production build and API DB query |
| R04 Neon | Environment loader and Prisma adapter | Real connection and rollback test |
| R05 JSON reuse | Schema, loader, public allowlist | Alternate profile; no hardcoded currency |
| R06 card and COD | Checkout, webhooks, collections | COD lifecycle; card scenarios deferred |
| R07 production scope | Fulfillment, returns, monitoring, recovery | Operational launch scenarios |
| R08 unseen screens | Details, checkout and CRUD style | Usability and consistency review |
| R09 professional GitHub | Branches, templates, checks and releases | Verified private repo and passing CI |

## Critical acceptance scenarios

| ID | Scenario | Pass condition |
| --- | --- | --- |
| A01 | Home at equivalent desktop viewport | Bento proportions, imagery and hierarchy match V01 |
| A02 | Lighting selected | Two reference-style cards, selected pill and correct quick-add behavior |
| A03 | Quick add then navigate | Bag count and item persist; accessible success toast appears |
| A04 | Sign in then open admin as customer | Form matches V03; customer access denied server-side |
| A05 | Main admin overview | V05 composition with measured live data, period/currency filters |
| A06 | Change JSON brand and locale | Labels, branding and date formatting update without source edits |
| A07 | Change market/currency | Explicit price book loads; no currency-symbol relabeling |
| A08 | Two buyers request final SKU | Exactly one reservation succeeds; stock stays valid |
| A09 | Order request is retried | One order, one reservation, same response reference |
| A10 | Browser tampers with price | Server ignores supplied price and recalculates |
| A11 | Deferred: card return before webhook | Order remains pending until trusted confirmation |
| A12 | Deferred: duplicate/out-of-order webhook | One financial effect; paid state cannot regress |
| A13 | Deferred: late card payment after stock release | Stock is rechecked or exception/refund path occurs |
| A14 | COD order delivered | Allocated stock ships; receipt recorded independently |
| A15 | Cancel races with shipping | Only compatible state transition succeeds |
| A16 | Partial return/refund retry | Correct saved allocation, no excess refund or double restock |
| A17 | Guess another order ID | No order/address/guest details disclosed |
| A18 | Invalid config or missing shipping rules | Startup/checkout fails clearly; no silent zero fee |
| A19 | Worker/provider outage | Durable jobs retry, dead letters surface, no lost transaction |
| A20 | Restore and redeploy | Recovered data/config/assets satisfy measured recovery targets |

## Testing strategy

Unit-test financial rounding, coupon eligibility and state transitions. Run database integration tests against a disposable branch for inventory concurrency, idempotency, ownership, coupon limits and refund ceilings. Use browser E2E tests for guest purchase, customer purchase, card challenge/failure, COD, admin fulfillment and returns. Use provider sandbox webhooks rather than only mocked browser redirects.

Visual tests use locally retained reference captures; do not push analysis frames, crops or QA render images to GitHub. Initial comparisons require human review because the reference is small and contains clipped content. Test five viewport widths, long translations, keyboard use, focus return from dialogs and reduced motion. Avoid asserting pixel identity to a compressed frame.

## Launch checklist

- Resolve owner market, branding, tax, shipping, payment provider, email and assets.
- Verify live/test credential separation, production admin authentication and no demo bypass.
- Complete all critical acceptance scenarios and record evidence with no secrets.
- Confirm accurate policies, prices, stock and delivery promises.
- Run build, lint, type, migration and integration checks on the release commit.
- Verify HTTPS, domain routes, payment callbacks, emails and monitoring.
- Test restore and application rollback; name the operating owner.
- Tag the release, publish release notes and retain the migration/config revision.

This checklist is the future release standard. It is not a claim that a production store is ready at this documentation stage.
