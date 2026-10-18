# Functional specification

> Current release scope: cash on delivery is active; SSLCommerz and card/webhook scenarios are deferred by the owner. Frontend and backend implementations live in `frontend/` and `backend/`. The 87-operation OpenAPI inventory and implementation/operator guides reflect current routes; card-provider sections below describe a future extension.

## Customer routes

| Route | Screen | Behavior | Basis |
| --- | --- | --- | --- |
| `/` | Home | Hero, featured product, category and delivery tiles | V01 |
| `/shop` | Catalog | Category pills, cards, quick add, search, sorting | V02 and extensions |
| `/products/:slug` | Product | Gallery, variants, price, dimensions, availability | Proposed |
| `/sign-in` | Authentication | Sign in and create account tabs | V03 |
| `/forgot-password` | Recovery | Generic acknowledgement and reset email | Proposed |
| `/reset-password` | Password reset | Expiring single-use token | Proposed |
| `/verify-email` | Email verification | Consume verification token | Proposed |
| `/bag` | Bag | Quantity, removal, availability and totals | Proposed |
| `/checkout` | Checkout | Address, shipping, payment and review | Proposed |
| `/orders/:id?confirmed=1` | Confirmation | Reference and actual payment status | Proposed |
| `/account` | Account | Profile, saved addresses and order list | Proposed |
| `/orders/:id` | Order | Timeline, shipment, cancellation and returns | Proposed |
| `/order-access` | Guest access | Request private order-access email | Proposed |
| `/policies/:slug` | Policies | Shipping, returns, privacy and terms | Proposed |
| `/contact` | Contact | Configured support details | Proposed |

## Catalog and accounts

F01. Public catalog queries expose published products only, in the enabled market and selected price book. Category and search state survive refresh through URL parameters. Proposed filters are category, q, minPriceMinor, maxPriceMinor, availability, sort and cursor. Sort supports featured, ascending price, descending price and newest. Limit each response to 48 items.

F02. Product details include gallery, name, description, materials, dimensions, care, variant options, price and stock. Every purchasable product has a SKU, including products without visible options. Quick add chooses a default SKU only when no customer choice is needed; otherwise it opens details. Dimensions retain numeric units independently of translated labels.

F03. Reference ratings require genuine published reviews or explicitly labeled demo data. As a production extension, allow one active review per fulfilled purchased order item; scores range from one to five. Admin moderation records an audit trail. Compute averages from published reviews only. Never copy the demo rating counts into production data.

F04. Registration collects name, email, password and current terms acceptance. Normalize emails for uniqueness. Email verification and password resets use expiring, hashed, single-use tokens. Recovery responses never disclose whether an account exists. Password changes invalidate other sessions. Clients cannot assign roles. Use opaque server sessions in secure cookies.

F05. Customers manage profile and addresses and access only their own orders. Deleting an address does not change historical orders. Guest access uses an expiring order-scoped link; knowing an order number is insufficient. Email changes require verification and revoke previous verification. Guest checkout is configurable.

## Bag and checkout

F06. Anonymous bags use opaque cookies with server-stored contents. On login, merge account and anonymous bags once in a transaction, combine duplicate SKUs within stock and quantity limits, retire the anonymous bag, and show adjustment notices. Adding to a bag checks availability but does not reserve stock.

F07. The server calculates prices, coupon eligibility, tax and delivery. Clients submit SKU IDs and quantities, never authoritative totals. Market, currency, coupon, shipping method or address changes require a new quote. Switching currency selects an explicit price book and asks the customer to review price changes.

F08. Checkout collects email, recipient and address fields required by the configured country. It validates delivery coverage and presents items, discounts, shipping, tax treatment, total, currency, estimated delivery and policies before submission. Quotes include expiry and configuration revision. Price changes or expiry require a refreshed quote before payment.

F09. Submission requires an idempotency key. A transaction rechecks price, coupon use, delivery and inventory; creates immutable order snapshots; reserves stock; and writes an outbox event. Same key, scope and request fingerprint return the original result; a changed fingerprint returns conflict. External provider calls occur after commit.

F10. Card checkout creates a hosted provider session. Raw card details never reach Express or PostgreSQL. Browser return URLs cannot mark orders paid. Verified provider webhooks or authenticated reconciliation confirm payment. Handle payment challenges, failure, cancellation, retries and delayed or duplicate events.

F11. Proposed card reservations expire after 15 minutes. Before releasing inventory, the worker checks or cancels the provider session. A late payment after release must reacquire stock atomically; if unavailable, record a stock exception, block shipment and initiate refund or manual review. Never silently oversell.

F12. COD is available only for configured zones and below its configured currency-specific cap. Confirmation allocates stock without marking payment paid. An authorized admin or verified carrier update records collection. Failed delivery or cancellation releases or returns inventory according to its physical state. Collection is distinct from order confirmation.

## Order service and returns

F13. Confirmation shows actual payment state, including pending verification. The order page shows shipment and tracking. Default cancellation cutoff is before shipment creation, configurable within supported rules. Cancellation and shipment creation must serialize so both cannot succeed incompatibly. A paid cancellation shows refund pending until the provider confirms the refund.

F14. Returns select delivered items, quantities and reasons. Enforce configured return windows and previously returned/refunded quantities. Admin approval creates return instructions. Receipt records condition and restock decisions per item. Refund and restock are separate actions. A failed refund remains visible and safely retryable. Launch policies must be supplied for each chosen market.

## Admin routes

| Route | Capabilities | Basis |
| --- | --- | --- |
| `/admin` | Period metrics, trends, daily goal, recent orders | V05 |
| `/admin/orders` | Search, filters, pagination and CSV export | Visible menu |
| `/admin/orders/:id` | Fulfillment, shipment, cancellation, refunds, timeline | Proposed |
| `/admin/products` | Product CRUD, publication, archive and price books | Visible menu |
| `/admin/products/:id` | Variants, images, dimensions, stock and SEO | Proposed |
| `/admin/categories` | Category CRUD, ordering and navigation | Visible menu |
| `/admin/inventory` | Stock balances, adjustments and low-stock view | Proposed |
| `/admin/returns` | Approval, receipt and refund initiation | Proposed |
| `/admin/reviews` | Moderate reviews | Proposed |
| `/admin/content` | Hero, featured products, tiles and policy content | Visible menu |
| `/admin/media` | Upload and manage assets | Proposed |
| `/admin/settings` | Active JSON revision and integration readiness | Proposed |
| `/admin/audit` | Privileged actions and failures | Proposed |

F15. Begin the sidebar with the five visible items: Overview, Orders, Products, Categories, Storefront. Group additional pages under these sections to preserve the compact design. Every admin API requires ADMIN authorization. Bootstrap the initial admin through a controlled command or invitation. No public admin registration or demo bypass exists in production.

F16. Publication requires category, active SKU, enabled-market price and image with alt text. Slugs and SKU codes are unique. Reassign products before deleting a used category. Archive products with order history. Inventory adjustments require a reason and actor and write a ledger entry. Concurrent edits use version checks and return a conflict rather than overwrite changes.

F17. Fulfillment captures quantities, carrier and tracking. Launch supports one shipment per order; shipment-item records allow later partial shipment support. Refunds require reason, idempotency key and an amount no greater than the captured unrefunded balance. COD refunds use a documented manual payout workflow and do not pretend to call a card provider.

F18. Storefront content has draft, preview, publish and rollback revisions. Product/order data remains relational; store-wide variables remain JSON. The settings page shows configuration readiness; changes to the versioned JSON are reviewed and deployed through GitHub at launch. CSV exports escape formula-leading cells and expire download links. Errors preserve form input.

## Dashboard metric definitions

Use the store timezone and start-inclusive/end-exclusive intervals. Each response reports one currency and a preceding equal-length comparison period. Show a dash for undefined percentage change. Never add different currencies without an explicitly designed conversion policy.

Revenue means captured card receipts plus recorded COD collections minus successful refunds in the period, excluding tax and shipping. Orders counts non-cancelled confirmed orders created in that period. Average order value is those orders' merchandise totals after discounts divided by their count; it intentionally follows order creation rather than cash timing. Customers counts purchasing identities, using account IDs or normalized guest emails, not a claim of unique people.

The line chart toggles daily order count and revenue. Category revenue allocates merchandise receipts and item refunds to saved category snapshots. The Today ring uses the same revenue definition and a currency-specific configured goal; its visual caps at 100 percent while text shows the actual percentage. Recent orders polls every 30 seconds with a visible stale state on failure. Production does not simulate shopper traffic.
