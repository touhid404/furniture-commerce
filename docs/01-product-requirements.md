# Product requirements

> Current release scope: cash on delivery is active; SSLCommerz and card/webhook scenarios are deferred by the owner. Frontend and backend implementations live in `frontend/` and `backend/`. The 87-operation OpenAPI inventory and implementation/operator guides reflect current routes; card-provider sections below describe a future extension.

## Purpose and outcome

Build a furniture and homewares commerce platform that reproduces the supplied video's storefront and admin visual language. Customers browse products, manage a bag, place cash-on-delivery orders (online payment is deferred), and track purchases. A main admin manages the catalog, stock, orders, content, and store operations. React renders both experiences, Express owns business rules, and Prisma accesses PostgreSQL hosted by Neon.

This specification is a development baseline with explicit open business decisions. A reference frame confirms appearance; it does not establish backend behavior. Proposed behavior below completes the production workflow and must be tested before launch.

## Confirmed requirements

| ID | Requirement | Basis |
| --- | --- | --- |
| R01 | Reproduce the visible homepage, listing, sign-in and admin overview design | User and video |
| R02 | Provide customer and main-admin experiences | User |
| R03 | Use React, Express, PostgreSQL and Prisma | User |
| R04 | Connect to a user-supplied Neon database during implementation | User |
| R05 | Configure branding, countries, currencies, languages and store variables in JSON | User follow-up |
| R06 | Support cash on delivery; show online payment coming soon | User follow-up |
| R07 | Cover payments, delivery, returns, security, testing and deployment | User follow-up |
| R08 | Specify unseen screens in the same visual style | User acceptance of proposed approach |
| R09 | Maintain a private GitHub repository professionally and exclude analysis images | User follow-up |

## Actors and boundaries

A visitor can browse, select a market, maintain an anonymous bag, register, and use guest checkout where enabled. A customer additionally manages their profile, addresses and orders. The main admin can operate the store and create controlled content. A payment provider and a delivery operator exchange external status updates through verified integration paths. Automated jobs deliver queued notifications and remove unused storage objects.

The baseline is a single merchant, a single inventory pool, and one shipping address per order. Multiple configured markets and currencies are supported through explicit price books. A different owner deploys a different JSON profile and database. A marketplace, merchant onboarding service, multiwarehouse routing, subscriptions, loyalty points, and native mobile apps are future scope. These are not implied by the demo.

## Release scope

The production release includes the four reference screens; product details; search, filters and sorting; registration and account recovery; guest and account bags; shipping and checkout; COD orders (online payment deferred); order confirmation, tracking, cancellation and return requests; admin catalog, categories, inventory, order fulfillment, returns, refunds, reporting, home content and media; policy pages; and operational monitoring.

Card provider and delivery integrations use adapters so the chosen country does not force a frontend redesign. Provider selection, taxes, shipping fees, refund policy and business contact details remain owner-supplied decisions. Sample dollar amounts and Danish-themed names in the video are visual reference content, not confirmed business settings.

## Quality targets

These are proposed engineering acceptance targets, not measured results. At launch, critical shopping and admin tasks must work at 360, 390, 768, 1024 and 1440 CSS pixels with no accidental horizontal scrolling. Interactive controls must be keyboard usable, have accessible names, and meet WCAG 2.2 AA as a project target. Warm API reads should achieve p95 below 500 ms under an agreed 50 concurrent-user test; record cold-start latency separately. Target LCP at or below 2.5 seconds and CLS at or below 0.1 on representative storefront pages using an agreed mobile test profile.

Proposed service availability is 99.5 percent per month, with recovery objectives of four hours for restoration and 24 hours maximum data loss until the selected Neon plan and backup process support tighter objectives. These targets require budget and infrastructure confirmation. Do not advertise them as guarantees before verification.

## Completion rule

A release is complete when reference-screen visual comparisons pass, all critical shopping and admin journeys pass, stock and money remain correct under retries and concurrent orders, production configuration has no unresolved integration values, and a restore rehearsal succeeds. An attractive dashboard with static data does not satisfy operational requirements.
