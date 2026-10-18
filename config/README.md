# Store configuration guide

The active JSON profile is [`stores/default.json`](stores/default.json). Keep store-specific defaults here so the project can be reused for another owner. Keep passwords, database URLs, S3 keys, SMTP passwords and other secrets in the ignored root `.env.local` or the hosting secret manager.

## Everyday changes: use Admin → Settings

Sign in as an administrator, open Settings, edit the form and choose **Save store settings**. Review the confirmation and confirm. The backend validates the values, saves a JSON revision in PostgreSQL, and refreshes the storefront. Cancel makes no change. Settings survive backend restarts.

| Setting | What you can update |
| --- | --- |
| Store details | Store name, support email, tagline and timezone |
| Default language/region | Select an already configured locale or selling market |
| Homepage | Season label, headline, featured product SKU and delivery promise |
| Delivery | Charge, free-delivery threshold, minimum and maximum delivery days |
| Orders | Maximum quantity per product and maximum COD order value per currency |
| Returns | Return window in days |

Internal mode, demo/security flags, database credentials and payment-provider setup are deliberately absent from this form. The removed sidebar Demo badge is a visual change; it does not disable authentication or production safeguards. Online payments remain coming soon.

## What the JSON fields control

| JSON key | Purpose and important rules |
| --- | --- |
| `brand` | Store name, tagline, support email and optional local logo path. Use a valid email; logo paths must start with `/`, not `//`. |
| `timezone` | IANA timezone such as `Asia/Dhaka` or `UTC`. Determines store reporting dates. |
| `defaultLocale`, `locales`, `messages` | Configured language/formatting choices and message dictionaries. Every enabled locale needs a dictionary. The present interface is English; a new language also needs complete interface translations and layout testing. |
| `defaultMarketId`, `markets` | Selling regions: unique market ID, two-letter country, currency, locales and enabled status. The default must be enabled. |
| `currencies` | Three-letter currency code and decimal precision. Every market must use a configured currency. |
| `navigation` | Menu labels and local links. Use paths such as `/shop?category=lighting`; external URLs are rejected. |
| `home` | Homepage copy, delivery promise and the featured product's actual SKU. |
| `theme` | Existing color tokens. Keep the approved combination unless a future redesign is explicitly requested. |
| `checkout.maxQuantityPerSku` | Maximum per product, from 1 to 100. Stock can impose a smaller limit. |
| `checkout.cod` | COD enablement, allowed delivery countries and per-currency maximum order totals. |
| `shipping.rates` | Market/currency-specific fees, free-delivery threshold, service label and estimated days. Each service ID must be unique within its market. Minimum days must not exceed maximum days. |
| `tax` | Explicit tax configuration, rate in basis points, inclusive/exclusive treatment and shipping taxation. Have the merchant approve the correct rules before selling. |
| `returns.windowDays` | Number of days allowed to request a return after delivery. |
| `dashboard` | Reporting refresh interval and explicit daily goal per currency. No fake traffic is generated. |

`schemaVersion`, `storeId`, `mode`, `features`, authentication flags and card-provider fields are deployment settings. Ordinary store administration does not require changing them. A real launch needs a reviewed production profile, HTTPS, strong administrator credentials and MFA. The Neon branch name `production` alone does not change application security mode.

## Money amounts

Amounts ending in `Minor` use the smallest currency unit. With USD precision 2, `500` means $5.00, `14400` means $144.00 and `100000` means $1,000.00. With a zero-decimal currency, `500` means 500 currency units. Never enter a decimal into a minor-unit field.

Tax uses basis points: `500` means 5%, `750` means 7.5%. Existing orders retain their saved monetary snapshots; new rules apply to new quotes. Customers with stale quotes must review current totals again.

## Adding a country or currency

1. Add the currency and its precision if needed.
2. Add a unique market with its country, currency and locales.
3. Define matching shipping rules, COD countries/caps and explicitly approved tax treatment.
4. Create actual prices for each sellable SKU in that market through the admin price-book editor or a reviewed data change. Changing a currency label does not convert prices. Products without a matching price are hidden in that market.
5. Select the desired default market and validate. Test listing, cart, shipping and checkout before exposing the new region to customers.

The sample catalog is defined separately in [`backend/prisma/seeds/products.json`](../backend/prisma/seeds/products.json), with its own [seed guide](../backend/prisma/seeds/README.md). Normal seeding creates missing products and preserves existing edits/stock; it does not overwrite prices of existing products. Never use a database reset to update store settings or product prices.

## Applying reviewed JSON changes

The file is the bootstrap default. Once Admin Settings has saved a profile, persisted merchant values take priority over file defaults. To publish a reviewed file to an existing store, use the operator command below; ordinary changes are easier in the Settings form.

```bash
npm run check:config
npm test
npm run config:apply
```

The last command is a **read-only dry run**. It prints the current saved revision. Review the diff and selected database, then explicitly publish with that exact revision:

```bash
npm run config:apply -- --apply --expected-revision CURRENT_REVISION_FROM_DRY_RUN
```

`ADMIN_EMAIL` in the server environment must identify an active administrator. Publishing creates an audit record and rejects a stale revision. It never reads credentials from the JSON. The saving process applies immediately; other API/worker instances refresh within five seconds. Restart the app after reviewed deployment/security changes. Keep exactly one local `.env.local` and do not commit it.

Before deployment, also run `npm run lint`, `npm run build`, `npm run check:docs` and `npm run prisma:validate`. Test fixtures belong on an isolated test branch. Never reset production as part of configuration changes.
