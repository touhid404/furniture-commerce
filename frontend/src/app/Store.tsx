import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearSession, initializeCsrf, send } from '../lib/api.js';
import type { Cart, Category, StoreConfig, User } from '../lib/types.js';
interface State {
  config: StoreConfig;
  categories: Category[];
  user: User | null;
  cart: Cart;
  refresh: () => Promise<void>;
  add: (variantId: string, quantity?: number) => Promise<void>;
  updateCart: (cart: Cart) => void;
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
  const s = useContext(Store);
  if (!s) throw new Error('Store context is missing');
  return s;
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<StoreConfig | null>(null),
    [categories, setCategories] = useState<Category[]>([]),
    [user, setUser] = useState<User | null>(null),
    [cart, setCart] = useState<Cart | null>(null),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [locale, setLocale] = useState('en-US');
  const refresh = useCallback(async () => {
    await initializeCsrf();
    const [me, bag] = await Promise.all([
      api<{ user: User | null }>('/auth/me'),
      api<Cart>('/cart'),
    ]);
    setUser(me.user);
    setCart(bag);
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([api<StoreConfig>('/config'), api<Category[]>('/categories'), refresh()])
      .then(([c, cats]) => {
        if (active) {
          setConfig(c);
          setCategories(cats);
          setLocale(c.defaultLocale);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [refresh]);
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
  if (!config || !cart)
    return (
      <main className="boot" role="status">
        <span className="brand-mark">✳</span>
        <p>Making room for something good…</p>
      </main>
    );
  const money = (minor: string | number, currency = cart.currency) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits:
        config.currencies.find((c) => c.code === currency)?.minorUnitDigits ?? 2,
    }).format(
      Number(minor) /
        10 ** (config.currencies.find((c) => c.code === currency)?.minorUnitDigits ?? 2),
    );
  const add = async (variantId: string, quantity = 1) => {
    setCart(await send<Cart>('/cart/items', { variantId, quantity }));
    setToast('A little something good, added to your bag.');
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
        cart,
        refresh,
        add,
        updateCart: setCart,
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
