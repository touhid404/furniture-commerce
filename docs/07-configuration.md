# JSON configuration and localization

## Configuration contract

The owner requested countries, currencies and other store variables in JSON so another owner can adapt the store. Use one versioned JSON profile per deployment. `store.example.json` is an illustrative profile in the video's USD/English style; it is not the selected launch country. Validate against `store.schema.json` at startup, in CI and before publishing configuration changes.

JSON controls brand identity, logo path, theme tokens, supported locales, default market, market-to-currency relationships, money precision, timezone, navigation labels, hero copy, checkout flags, card/COD enablement, stock-reservation duration, delivery rules, tax mode and dashboard goals. Locale dictionaries hold configurable messages. The current interface is English; adding complete translations and RTL layout acceptance is additional owner setup. Product translations and prices remain database records. Credentials belong only in backend environment variables, never in public JSON, GitHub, screenshots or a frontend build.

## Public and server configuration

The API exposes only an allowlisted subset through `/config`: branding, theme, locales, display currencies, market options, navigation, published content and customer-visible checkout options. Internal provider settings, operational caps, trusted origins and administrative feature controls remain server-side. Do not publish the full JSON object by default.

At startup, select `STORE_CONFIG_PATH`, validate the bootstrap JSON, then load any saved `StoreSettings` JSON revision from PostgreSQL. The API and worker refresh this bounded cache every five seconds, and the process saving settings applies the revision immediately. Fail fast on invalid currency mappings, unavailable locales, unknown timezone, duplicate IDs, contradictory COD settings or unsafe URLs. A production profile rejects demo bypasses and unresolved shipping/tax setup. Card setup remains disabled and server-controlled in the COD-only release. The example intentionally marks integrations and launch rules unconfigured until supplied.

## Localization and price books

Use BCP 47 locale identifiers and Intl formatting for dates, numbers and money. Country codes are explicit market settings. Money precision is defined per currency, not universally assumed to be two decimals. Show fallback copy from the configured default locale and log missing translation keys. Locale switches cannot change the amount owed. RTL languages require mirrored layout testing when enabled.

Selecting another currency must load an actual per-SKU price in that market. Hide unavailable prices rather than apply an undocumented exchange rate. Each bag and order uses a single market and currency. Store timezone drives dashboard day boundaries; the database retains UTC timestamps. Order receipts use the saved locale, currency and configuration revision.

## Administration and owner reuse

Admin Settings provides ordinary form fields for store name, support email, tagline, timezone, default configured language/region, homepage text, featured SKU, delivery fees and times, maximum product quantities, COD caps and the return window. It does not expose raw JSON, demo mode, credentials or deployment/security flags. Validated JSON is persisted in the separate `StoreSettings` table with optimistic revision checks and an audit event. The root JSON remains the bootstrap profile; saved settings survive restarts. New markets/currencies still require reviewed explicit SKU price books and delivery setup. Settings cannot change the deployment store ID, mode, authentication features or card integration. A stale revision returns 409; invalid or locked values return 422.

Only server-authorized administrators may read or write admin settings. The frontend asks for confirmation before saving and refreshes its public profile afterward. The public endpoint retains its allowlist. Changed configuration revisions invalidate pending checkout quotes so the customer reviews current charges.

To adapt for another owner: copy the example, set a unique store ID and brand, choose markets/locales/currencies, supply original assets, set price books and delivery/tax rules, configure provider credentials in that deployment's environment, validate, test and deploy against its own database. This is reusable single-store software. Shared merchant onboarding and tenant isolation are a separate feature.

## Example limitations

The example uses English and USD solely to match the reference's labels. All integration placeholders must be resolved before production. A zero shipping charge or zero tax entry must never be inferred from missing configuration. An explicit unconfigured state blocks checkout. JSON Schema checks structure; runtime checks validate cross-field relationships and external integration readiness.

For practical editing instructions see the [guide beside the JSON folder](../config/README.md). `npm run config:apply` validates the reviewed file in read-only mode. Publishing requires `--apply --expected-revision` and an active `ADMIN_EMAIL`; it saves through the same validation, revision and audit service. Deployment/security changes require an application restart.
