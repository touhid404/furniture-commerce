import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, clearSession, send } from '../lib/api.js';
import { Loading } from '../components/UI.js';
import { resource } from '../lib/resource-cache.js';
import {
  addItem,
  CART_KEY,
  changeQuantity,
  emptyCart,
  parseCart,
  subtractPurchased,
  totalCart,
} from '../lib/local-cart.js';
import type { Cart, Category, Product, StoreConfig, User } from '../lib/types.js';
interface State {
  config: StoreConfig;
  categories: Category[];
  user: User | null;
  authReady: boolean;
  cart: Cart;
  refresh: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  add: (product: Product, variantId?: string, quantity?: number) => Promise<void>;
  updateCart: (cart: Cart, expectedVersion?: number) => void;
  quantity: (id: string, amount: number) => void;
  syncCart: () => Promise<Cart>;
  setMarket: (marketId: string) => Promise<void>;
  purchased: (items: { variantId: string; quantity: number }[]) => void;
  notify: (message: string) => void;
  logout: () => Promise<void>;
  market: string;
  locale: string;
  setLocale: (v: string) => void;
  money: (minor: string | number, currency?: string) => string;
  toast: string;
  dismiss: () => void;
}
const Store = createContext<State | null>(null);
export function useStore() {
  const state = useContext(Store);
  if (!state) throw Error('Store context is missing');
  return state;
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<StoreConfig | null>(null),
    [categories, setCategories] = useState<Category[]>([]),
    [user, setUser] = useState<User | null>(null),
    [authReady, setAuthReady] = useState(false),
    [cart, setCart] = useState<Cart | null>(null),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [locale, setLocale] = useState('en-US');
  const cartRef = useRef<Cart | null>(null);
  const updateCart = useCallback((next: Cart, expectedVersion?: number) => {
    if (expectedVersion !== undefined && cartRef.current?.version !== expectedVersion)
      throw Error('Your bag changed. Apply the promotion again.');
    const value = totalCart({ ...next, version: cartRef.current?.version ?? next.version });
    cartRef.current = value;
    setCart(value);
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(value));
    } catch {
      setToast('Your bag is available in this tab. Browser storage is unavailable.');
    }
  }, []);
  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: User | null }>('/auth/me');
      setUser(me.user);
    } finally {
      setAuthReady(true);
    }
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([resource<StoreConfig>('/config'), resource<Category[]>('/categories')])
      .then(([c, cats]) => {
        if (!active) return;
        let market = c.data.markets.find((m) => m.id === c.data.defaultMarketId)!;
        let stored: string | null = null;
        try {
          stored = localStorage.getItem(CART_KEY);
        } catch {
          /* Storage is optional. */
        }
        try {
          const saved = JSON.parse(stored ?? 'null');
          const selected = c.data.markets.find(
            (m) => m.id === saved?.marketId && m.currency === saved?.currency,
          );
          if (selected) market = selected;
        } catch {
          /* Malformed storage uses the configured default. */
        }
        const bag = parseCart(stored, emptyCart(market.id, market.currency));
        cartRef.current = bag;
        setCart(bag);
        setConfig(c.data);
        setCategories(cats.data);
        setLocale(c.data.defaultLocale);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    // Authentication never blocks the public catalog and never creates a guest database cart.
    resource<{ user: User | null }>('/auth/me')
      .then((me) => {
        if (active) setUser(me.data.user);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!config) return;
    for (const [key, value] of Object.entries(config.theme))
      document.documentElement.style.setProperty(`--${key}`, value);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CART_KEY || !cartRef.current) return;
      const bag = parseCart(
        event.newValue,
        emptyCart(cartRef.current.marketId, cartRef.current.currency),
      );
      bag.version = cartRef.current.version + 1;
      cartRef.current = bag;
      setCart(bag);
    };
    addEventListener('storage', onStorage);
    return () => removeEventListener('storage', onStorage);
  }, [config]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  if (error)
    return (
      <main className="boot">
        <h1>We couldn’t open the store.</h1>
        <p role="alert">{error}</p>
        <button onClick={() => location.reload()}>Try again</button>
      </main>
    );
  if (!config || !cart) return <Loading variant="store" />;
  const money = (minor: string | number, currency = cart.currency) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits:
        config.currencies.find((c) => c.code === currency)?.minorUnitDigits ?? 2,
    }).format(
      Number(minor) /
        10 ** (config.currencies.find((c) => c.code === currency)?.minorUnitDigits ?? 2),
    );
  const add = async (product: Product, variantId = product.variants[0]?.id, quantity = 1) => {
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) throw Error('Select a product option.');
    updateCart(
      addItem(cartRef.current!, product, variant, quantity, config.checkout.maxQuantityPerSku),
    );
    setToast('A little something good, added to your bag.');
  };
  const syncCart = async () => {
    const bag = cartRef.current!;
    const fresh = await send<Cart>('/cart/sync', {
      items: bag.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      marketId: bag.marketId,
      couponCode: bag.couponCode,
    });
    if (cartRef.current!.version !== bag.version)
      throw Error('Your bag changed during review. Please review it again.');
    return fresh;
  };
  const setMarket = async (marketId: string) => {
    const market = config.markets.find((m) => m.id === marketId);
    if (!market) throw Error('Select a configured market.');
    const bag = cartRef.current!;
    const prices = bag.items.length
      ? await api<
          { variantId: string; unitPriceMinor: string; available: number; purchasable: boolean }[]
        >(
          `/product-prices?marketId=${encodeURIComponent(marketId)}&ids=${bag.items.map((i) => i.variantId).join(',')}`,
        )
      : [];
    if (bag.version !== cartRef.current!.version)
      throw Error('Your bag changed. Select the region again.');
    updateCart({
      ...bag,
      marketId,
      currency: market.currency,
      couponCode: null,
      items: bag.items.map((i) => ({
        ...i,
        ...(prices.find((p) => p.variantId === i.variantId) ?? {
          unitPriceMinor: '0',
          available: 0,
          purchasable: false,
        }),
      })),
    });
  };
  const refreshConfig = async () => {
    const next = await api<StoreConfig>('/config');
    setConfig(next);
    if (!next.locales.includes(locale)) setLocale(next.defaultLocale);
    if (
      !next.markets.some(
        (m) => m.id === cartRef.current?.marketId && m.currency === cartRef.current.currency,
      )
    ) {
      const market = next.markets.find((m) => m.id === next.defaultMarketId)!;
      // Preserve selected products, but invalidate old-market prices until authoritative review.
      updateCart({
        ...cartRef.current!,
        marketId: market.id,
        currency: market.currency,
        couponCode: null,
        items: cartRef.current!.items.map((item) => ({
          ...item,
          purchasable: false,
          unitPriceMinor: '0',
        })),
      });
    }
  };
  const logout = async () => {
    await send('/auth/logout');
    clearSession();
    await refresh();
    setToast('You’re signed out.');
  };
  return (
    <Store.Provider
      value={{
        config,
        categories,
        user,
        authReady,
        cart,
        refresh,
        refreshConfig,
        add,
        updateCart,
        setMarket,
        quantity: (id, amount) =>
          updateCart(
            changeQuantity(cartRef.current!, id, amount, config.checkout.maxQuantityPerSku),
          ),
        syncCart,
        purchased: (items) => updateCart(subtractPurchased(cartRef.current!, items)),
        notify: setToast,
        logout,
        market: cart.marketId,
        locale,
        setLocale,
        money,
        toast,
        dismiss: () => setToast(''),
      }}
    >
      {children}
    </Store.Provider>
  );
}
