# JSON configuration and localization

## Configuration contract

The owner requested countries, currencies and other store variables in JSON so another owner can adapt the store. Use one versioned JSON profile per deployment. `store.example.json` is an illustrative profile in the video's USD/English style; it is not the selected launch country. Validate against `store.schema.json` at startup, in CI and before publishing configuration changes.

JSON controls brand identity, logo path, theme tokens, supported locales, default market, market-to-currency relationships, money precision, timezone, navigation labels, hero copy, checkout flags, card/COD enablement, stock-reservation duration, delivery rules, tax mode and dashboard goals. Locale dictionaries hold all UI labels and validation text. Product translations and prices remain database records. Credentials belong only in backend environment variables, never in public JSON, GitHub, screenshots or a frontend build.

## Public and server configuration

The API exposes only an allowlisted subset through `/config`: branding, theme, locales, display currencies, market options, navigation, published content and customer-visible checkout options. Internal provider settings, operational caps, trusted origins and administrative feature controls remain server-side. Do not publish the full JSON object by default.

At startup, select `STORE_CONFIG_PATH`, parse once, validate schema and cross-field rules, compute a content hash, and freeze the active config. Fail fast on invalid currency mappings, unavailable locales, unknown timezone, duplicate IDs, contradictory COD settings or unsafe URLs. A production guard also rejects demo mode, unconfigured card adapters and unresolved shipping/tax setup. The example intentionally marks integrations and launch rules unconfigured until supplied.

## Localization and price books

Use BCP 47 locale identifiers and Intl formatting for dates, numbers and money. Country codes are explicit market settings. Money precision is defined per currency, not universally assumed to be two decimals. Show fallback copy from the configured default locale and log missing translation keys. Locale switches cannot change the amount owed. RTL languages require mirrored layout testing when enabled.

Selecting another currency must load an actual per-SKU price in that market. Hide unavailable prices rather than apply an undocumented exchange rate. Each bag and order uses a single market and currency. Store timezone drives dashboard day boundaries; the database retains UTC timestamps. Order receipts use the saved locale, currency and configuration revision.

## Administration and owner reuse

At launch, admins can view the active config and readiness but change owner-wide variables through reviewed JSON commits and redeployment. Catalog and home content have admin workflows because they are operational records. A future settings editor may export validated JSON revisions; it must preserve this contract and cannot write arbitrary environment secrets.

To adapt for another owner: copy the example, set a unique store ID and brand, choose markets/locales/currencies, supply original assets, set price books and delivery/tax rules, configure provider credentials in that deployment's environment, validate, test and deploy against its own database. This is reusable single-store software. Shared merchant onboarding and tenant isolation are a separate feature.

## Example limitations

The example uses English and USD solely to match the reference's labels. All integration placeholders must be resolved before production. A zero shipping charge or zero tax entry must never be inferred from missing configuration. An explicit unconfigured state blocks checkout. JSON Schema checks structure; runtime checks validate cross-field relationships and external integration readiness.
