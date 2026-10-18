# API specification

> Current release scope: cash on delivery is active; SSLCommerz and card/webhook scenarios are deferred by the owner. Frontend and backend implementations live in `frontend/` and `backend/`. The 87-operation OpenAPI inventory and implementation/operator guides reflect current routes; card-provider sections below describe a future extension.

## Contract conventions

Base path is `/api/v1`. JSON requests use UTF-8. Success responses are `{data, meta?}` and failures are `{error:{code,message,fields?},requestId}`. IDs are UUID strings; timestamps are UTC ISO 8601. Money is `{amountMinor:"18900",currency:"USD"}`. Never serialize a JavaScript BigInt directly. Implemented list responses use page/limit and stable tie-breaker IDs: the public catalog allows up to 48 items, admin lists up to 100. The matrix below retains the full planning contract, including deferred extensions. The generated OpenAPI artifact is the authoritative inventory of 87 implemented operations; backend DTOs define strict request validation.

Use an opaque `__Host-kvist_session` cookie with Secure, HttpOnly, Path=/ and SameSite=Lax in HTTPS environments. Authenticated and anonymous sessions are distinguished server-side. A synchronizer CSRF token is required for cookie-authenticated mutations, including login, except verified provider webhooks. First fetch `/auth/csrf` to establish an anonymous session and token. Rotate session identifiers on login and privilege changes. Reject unrecognized input fields on privileged mutations to prevent mass assignment.

GET is read-only; POST creates a resource or requests a named domain action; PATCH updates permitted fields; DELETE removes a bag line or revokes a draft association. Use 200/201/202/204 for successful outcomes; 400 malformed input, 401 missing identity, 403 insufficient role, 404 absent or inaccessible resource, 409 version/stock/idempotency conflicts, 422 valid syntax with invalid business input, 429 rate limit and 503 dependency unavailable. Include Retry-After where meaningful. No stack traces or credentials reach clients.

## Planning endpoint matrix

The Access column means public, anonymous/account session, customer ownership, order-scoped guest access, admin role, or signed provider event. Customer ownership and guest access are checked per resource, not only per route.

| Method and path | Access | Purpose |
| --- | --- | --- |
| GET `/config` | Public | Allowlisted active store profile |
| GET `/content/:key` | Public | Published locale content |
| GET `/categories` | Public | Active ordered categories |
| GET `/products` | Public | Filtered and paginated catalog |
| GET `/products/:slug` | Public | Product, SKU options, price and availability |
| GET `/products/:id/reviews` | Public | Published reviews |
| GET `/auth/csrf` | Public | Session bootstrap and CSRF token |
| POST `/auth/register` | Session and CSRF | Customer registration |
| POST `/auth/login` | Session and CSRF | Authenticate and merge bag |
| POST `/auth/logout` | Session and CSRF | Revoke session |
| GET `/auth/me` | Session | Current customer/admin identity |
| POST `/auth/verify-email` | Session and CSRF | Consume email token |
| POST `/auth/forgot-password` | Session and CSRF | Send generic recovery acknowledgement |
| POST `/auth/reset-password` | Session and CSRF | Consume reset token |
| POST `/auth/order-access/request` | Session and CSRF | Email private order-access link |
| POST `/auth/order-access/consume` | Session and CSRF | Exchange token for scoped access |
| GET/PATCH `/account` | Customer | Read/update allowed profile fields |
| POST `/account/change-email` | Customer | Begin verified email change |
| GET/POST `/account/addresses` | Customer | List/create saved addresses |
| PATCH/DELETE `/account/addresses/:id` | Owner | Update/delete saved address |
| GET `/cart` | Session | Bag with authoritative totals |
| POST `/cart/items` | Session and CSRF | Add SKU and quantity |
| PATCH/DELETE `/cart/items/:id` | Session owner and CSRF | Set quantity or remove |
| PATCH `/cart/context` | Session and CSRF | Change market/currency and reprice |
| POST/DELETE `/cart/coupon` | Session and CSRF | Apply/remove coupon |
| POST `/checkout/quotes` | Session and CSRF | Validate address and create quote |
| POST `/checkout/orders` | Session and CSRF | Submit quote and reserve order |
| POST `/orders/:id/payment-attempts` | Order owner | Retry eligible card payment |
| GET `/orders` | Customer | Own order history |
| GET `/orders/:id` | Owner or scoped guest | Order and tracking |
| POST `/orders/:id/cancellations` | Owner or scoped guest | Request eligible cancellation |
| POST `/orders/:id/returns` | Owner or scoped guest | Request eligible item return |
| POST `/order-items/:id/reviews` | Verified purchaser | Submit review |
| POST `/webhooks/payments/:provider` | Signed provider | Process verified raw-body event |
| POST `/webhooks/shipping/:provider` | Signed provider | Optional verified delivery updates |
| GET `/admin/dashboard` | Admin | Period/currency metrics and charts |
| GET `/admin/orders` | Admin | Search/filter orders |
| GET `/admin/orders/:id` | Admin | Full operational order view |
| POST `/admin/orders/:id/shipments` | Admin | Fulfill checked quantities |
| POST `/admin/shipments/:id/delivery` | Admin | Record delivery with reason/evidence |
| POST `/admin/orders/:id/cancellations` | Admin | Cancel eligible order |
| POST `/admin/orders/:id/cod-collections` | Admin | Record COD receipt |
| POST `/admin/orders/:id/refunds` | Admin | Request idempotent refund |
| GET/POST `/admin/products` | Admin | List/create products |
| GET/PATCH `/admin/products/:id` | Admin | Read/update product and version |
| POST `/admin/products/:id/publications` | Admin | Validate and publish |
| POST `/admin/products/:id/archive` | Admin | Archive while preserving history |
| POST/PATCH `/admin/products/:id/variants` | Admin | Create/update SKU configuration |
| PUT `/admin/variants/:id/prices` | Admin | Replace validated price book |
| GET/POST `/admin/categories` | Admin | List/create categories |
| PATCH/DELETE `/admin/categories/:id` | Admin | Edit/remove unused category |
| GET `/admin/inventory` | Admin | Balances and low-stock filters |
| POST `/admin/inventory/:variantId/adjustments` | Admin | Append inventory movement |
| GET `/admin/returns` | Admin | Filter return requests |
| POST `/admin/returns/:id/decisions` | Admin | Approve/reject with reason |
| POST `/admin/returns/:id/receipts` | Admin | Record receipt and restock decision |
| GET/PATCH `/admin/reviews/:id` | Admin | Read/moderate review |
| GET/POST `/admin/coupons` | Admin | List/create coupons |
| PATCH `/admin/coupons/:id` | Admin | Change allowed coupon fields |
| POST `/admin/media/uploads` | Admin | Restricted presigned upload request |
| POST `/admin/media/:id/completion` | Admin | Validate uploaded media |
| DELETE `/admin/media/:id` | Admin | Remove unused asset |
| GET/PUT `/admin/content/:key` | Admin | Read/create draft revision |
| POST `/admin/content/:key/publications` | Admin | Publish specified revision |
| POST `/admin/content/:key/rollback` | Admin | Restore prior content as a revision |
| GET `/admin/config` | Admin | Redacted active configuration/readiness |
| GET `/admin/audit` | Admin | Paginated privileged activity |
| POST `/admin/exports` | Admin | Audited asynchronous CSV export |
| GET `/admin/exports/:id` | Admin owner | Export status/expiring download |
| GET `/health/live` | Operations | Process liveness |
| GET `/health/ready` | Operations | Dependency readiness without credentials |

All account/admin mutations require CSRF even where the table abbreviates it. List/create and update routes with combined methods must become separate OpenAPI operations during their implementation. Variant PATCH should identify a variant in the body and verify its product relationship; a dedicated `/:variantId` path may be adopted when that module's full contract is written.

## Critical request shapes

Current guest bags are local. At authenticated checkout, sync `{marketId,items:[{variantId,quantity}],couponCode?}` to `/cart/sync`. Create a quote with `{contactEmail,shippingAddress,shippingMethodId}`; the response includes current item prices and totals. Submit `{quoteId,paymentMethod:"COD"}` with `Idempotency-Key`. The response contains the saved order. Card sessions and redirects are deferred.

Admin dashboard accepts range=7d|30d|90d and currency; return period, timezone, computedAt, metric values, comparison values, series, category allocations and recent orders. No frontend constants stand in for production metrics. Product edits require an expected version; return 409 if stale.

## Webhooks and errors

Register raw-body parsing for payment webhooks before the ordinary JSON body parser. Verify signatures and time windows according to the selected provider, store an event deduplication key, and acknowledge only after durable receipt. Duplicate valid events return success. Return retryable failure when persistence fails; do not acknowledge and silently discard the event. Webhooks never rely on browser cookies or CSRF tokens.

Stable error codes include VALIDATION_FAILED, AUTH_REQUIRED, FORBIDDEN, PRODUCT_UNAVAILABLE, STOCK_CHANGED, PRICE_CHANGED, QUOTE_EXPIRED, SHIPPING_UNAVAILABLE, PAYMENT_PENDING, PAYMENT_FAILED, IDEMPOTENCY_CONFLICT, VERSION_CONFLICT, RETURN_INELIGIBLE and DEPENDENCY_UNAVAILABLE. Show recoverable user messages and a request ID for support.

## Machine-readable scope

`docs/contracts/openapi.json` inventories the 87 implemented operations, with exact schemas for the critical shopping flow and store configuration. Backend request DTOs and authorization middleware define strict validation and access checks. The broader planning matrix above includes deferred routes; do not assume those exist unless they appear in the generated inventory and have passing implementation acceptance.
