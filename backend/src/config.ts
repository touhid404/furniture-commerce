import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type defaultStore from '../../config/stores/default.json';
import './env.js';

type ExampleConfig = typeof defaultStore;
export type StoreConfig = Omit<ExampleConfig, 'checkout' | 'dashboard' | 'messages'> & {
  checkout: Omit<ExampleConfig['checkout'], 'cod'> & {
    cod: Omit<ExampleConfig['checkout']['cod'], 'maximumByCurrency'> & {
      maximumByCurrency: Record<string, number>;
    };
  };
  dashboard: Omit<ExampleConfig['dashboard'], 'dailyGoalByCurrency'> & {
    dailyGoalByCurrency: Record<string, number>;
  };
  messages: Record<string, ExampleConfig['messages']['en-US']>;
};
const ajv = new Ajv2020({ allErrors: true });
const schema = JSON.parse(
  readFileSync(resolve(process.env.PROJECT_ROOT!, 'docs/config/store.schema.json'), 'utf8'),
);
const validate = ajv.compile<StoreConfig>(schema);

export function validateStoreConfig(input: unknown): StoreConfig {
  if (!validate(input))
    throw new Error(`Invalid store configuration: ${ajv.errorsText(validate.errors)}`);
  const value = input;
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (
    !unique(value.markets.map((x) => x.id)) ||
    !unique(value.currencies.map((x) => x.code)) ||
    !unique(value.locales)
  ) {
    throw new Error('Configuration IDs and locales must be unique');
  }
  const currencies = new Set(value.currencies.map((x) => x.code));
  const locales = new Set(value.locales);
  const enabledMarkets = value.markets.filter((x) => x.enabled);
  if (!enabledMarkets.some((x) => x.id === value.defaultMarketId))
    throw new Error('Default market must be enabled');
  if (!locales.has(value.defaultLocale)) throw new Error('Default locale is not enabled');
  for (const market of value.markets) {
    if (
      !currencies.has(market.currency) ||
      !market.locales.length ||
      market.locales.some((x) => !locales.has(x))
    ) {
      throw new Error('Market currency and locales must be configured');
    }
  }
  for (const locale of value.locales) {
    new Intl.DateTimeFormat(locale, { timeZone: value.timezone }).format();
    if (!(locale in value.messages)) throw new Error('Every locale requires a message dictionary');
  }
  for (const currency of value.currencies)
    new Intl.NumberFormat(value.defaultLocale, {
      style: 'currency',
      currency: currency.code,
    }).format(0);
  for (const entry of value.navigation) {
    if (!entry.href.startsWith('/') || entry.href.startsWith('//'))
      throw new Error('Navigation must use local paths');
  }
  if (
    value.brand.logoPath &&
    (!value.brand.logoPath.startsWith('/') || value.brand.logoPath.startsWith('//'))
  ) {
    throw new Error('Logo must use a local asset path');
  }
  for (const key of [
    ...Object.keys(value.checkout.cod.maximumByCurrency),
    ...Object.keys(value.dashboard.dailyGoalByCurrency),
  ]) {
    if (!currencies.has(key)) throw new Error('Money settings reference an unknown currency');
  }
  for (const rate of value.shipping.rates) {
    const market = value.markets.find((x) => x.id === rate.marketId);
    if (
      !market ||
      market.currency !== rate.currency ||
      rate.estimatedDaysMin > rate.estimatedDaysMax
    )
      throw new Error('Invalid shipping market or delivery range');
  }
  if (value.mode === 'production') {
    if (value.features.demoAdmin || value.features.simulateTraffic)
      throw new Error('Production cannot enable demo features');
    if (value.checkout.card.enabled && value.checkout.card.provider === 'unconfigured')
      throw new Error('Production card provider is unconfigured');
    if (!value.tax.configured || !value.shipping.configured)
      throw new Error('Production requires shipping and tax setup');
    if (value.checkout.cod.enabled && !value.checkout.cod.countryAllowlist.length)
      throw new Error('Production COD requires delivery countries');
    if (!process.env.SESSION_SECRET || !process.env.MFA_ENCRYPTION_KEY)
      throw new Error('Production requires session and MFA encryption secrets');
  }
  return value;
}

const rawConfig: unknown = JSON.parse(
  readFileSync(
    resolve(
      process.env.PROJECT_ROOT!,
      process.env.STORE_CONFIG_PATH ?? 'config/stores/default.json',
    ),
    'utf8',
  ),
);
export const storeConfig = validateStoreConfig(rawConfig);

export function publicStoreConfig() {
  const c = storeConfig;
  return {
    storeId: c.storeId,
    revision: c.revision,
    brand: c.brand,
    timezone: c.timezone,
    defaultLocale: c.defaultLocale,
    locales: c.locales,
    defaultMarketId: c.defaultMarketId,
    currencies: c.currencies,
    markets: c.markets.filter((m) => m.enabled),
    theme: c.theme,
    navigation: c.navigation,
    home: c.home,
    messages: c.messages,
    checkout: {
      guestEnabled: c.checkout.guestEnabled,
      codEnabled: c.checkout.cod.enabled,
      onlinePaymentLabel:
        c.messages[c.defaultLocale]?.onlinePaymentComingSoon ?? 'Online payment coming soon',
    },
    returns: c.returns,
    dashboard: { pollSeconds: c.dashboard.pollSeconds },
    demo: c.mode === 'demo' && c.features.demoAdmin,
    capabilities: {
      commerceReady: true,
      cardConfigured: c.checkout.card.provider !== 'unconfigured',
      shippingConfigured: c.shipping.configured,
    },
  };
}
