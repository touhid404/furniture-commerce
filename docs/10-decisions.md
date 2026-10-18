# Decisions and next inputs

## Confirmed decisions

| ID | Decision | Date |
| --- | --- | --- |
| D01 | React frontend, Express backend, PostgreSQL through Prisma | 18 October 2026 |
| D02 | Follow visible video design and extend unseen pages consistently | 18 October 2026 |
| D03 | Full production scope | 18 October 2026 |
| D04 | Online cards and cash on delivery | 18 October 2026 |
| D05 | Owner-specific variables in JSON | 18 October 2026 |
| D06 | Maintain GitHub professionally in a private repository | 18 October 2026 |
| D07 | Keep analysis images out of GitHub | 18 October 2026 |
| D08 | Set up specified Neon project and prove build and connectivity | 18 October 2026 |

## Working assumptions

One merchant per deployment, a single stock pool, one shipment per order at launch, configurable guest checkout, one currency per order, and deployment-selected owner profiles. These keep the project reusable without silently introducing a marketplace. Unseen screens follow the recorded visual language. These assumptions can change through documented architecture decisions.

## Inputs needed before commerce integrations

Choose the launch profile: business identity, countries served, locales, currencies and timezone. Supply original logo/product assets and complete homepage copy for exact matching. Choose a card provider that supports the owner's country and settlement requirements, then provide test credentials through environment variables. Define COD zones/caps, delivery provider or manual workflow, shipping fees, tax treatment, return windows and refund policies. Choose email, media storage and application hosting. None of these should block the current documentation or read-only Neon connection check.

The full headline, exact font and original image assets cannot be recovered from the 23-second compressed video. The product details, checkout, order-management and category-management screens are proposed designs because the video does not show them. This distinction must remain visible in future design reviews.

## Change control

Assign an issue to each material requirement change. Record why it changes, affected contract/data/config, migration impact and verification. Keep an architecture decision record for provider choice, SSR, authentication, shared tenancy or new infrastructure. Review changes against the reference so ordinary implementation choices do not drift into a redesign.
