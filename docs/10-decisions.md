# Decisions and next inputs

## Confirmed decisions

| ID | Decision | Date |
| --- | --- | --- |
| D01 | React frontend, Express backend, PostgreSQL through Prisma | 18 October 2026 |
| D02 | Follow visible video design and extend unseen pages consistently | 18 October 2026 |
| D03 | Full production scope | 18 October 2026 |
| D04 | Cash on delivery now; SSLCommerz deferred and online payment labelled coming soon | 18 October 2026 |
| D05 | Owner-specific variables in JSON | 18 October 2026 |
| D06 | Maintain GitHub professionally in a private repository | 18 October 2026 |
| D07 | Keep analysis images out of GitHub | 18 October 2026 |
| D08 | Set up specified Neon project and prove build and connectivity | 18 October 2026 |

## Working assumptions

One merchant per deployment, a single stock pool, one shipment per order at launch, configurable guest checkout, one currency per order, and deployment-selected owner profiles. These keep the project reusable without silently introducing a marketplace. Unseen screens follow the recorded visual language. These assumptions can change through documented architecture decisions.

## Owner inputs needed before commercial launch

Choose the actual merchant identity, countries served, locales, explicit currency price books and timezone. Replace illustrative catalog photos/specifications and sample policy copy with approved merchant assets. Confirm COD zones/caps, manual delivery workflow, delivery fees, tax treatment, returns and refund policy. Neon Object Storage is implemented; the public application host, domain/HTTPS and SMTP provider credentials remain external launch setup. These do not block local acceptance. Card integration is deferred at the owner's request.

The full headline, exact font and original image assets cannot be recovered from the 23-second compressed video. The product details, checkout, order-management and category-management screens are proposed designs because the video does not show them. This distinction must remain visible in future design reviews.

## Change control

Assign an issue to each material requirement change. Record why it changes, affected contract/data/config, migration impact and verification. Keep an architecture decision record for provider choice, SSR, authentication, shared tenancy or new infrastructure. Review changes against the reference so ordinary implementation choices do not drift into a redesign.
