import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Check,
  Menu,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { useStore } from '../app/Store.js';
import { useAction } from '../lib/hooks.js';
import { BagTotals } from './Promotion.js';
import { ProductArt } from './ProductArt.js';
import { Empty, Loading, Notice } from './UI.js';
export function Logo() {
  const { config } = useStore();
  return (
    <Link className="brand" to="/" aria-label={`${config.brand.name} home`}>
      {config.brand.logoPath ? (
        <img src={config.brand.logoPath} alt="" />
      ) : (
        <span className="brand-mark" aria-hidden="true">
          ✳
        </span>
      )}
      {config.brand.name}
    </Link>
  );
}
export function CartLines() {
  const { cart, config, quantity: updateQuantity, money } = useStore(),
    action = useAction();
  const change = (id: string, quantity: number) =>
    action.run(async () => updateQuantity(id, quantity));
  return (
    <>
      <Notice>{action.error}</Notice>
      {cart.items.map((i) => (
        <div className="bag-line" key={i.id}>
          <Link
            to={`/products/${i.slug}`}
            className="bag-image"
            style={{ background: i.background }}
          >
            <ProductArt {...i} />
          </Link>
          <div className="bag-info">
            <Link to={`/products/${i.slug}`}>
              <strong>{i.name}</strong>
            </Link>
            <small>{i.label}</small>
            <span>{money(i.unitPriceMinor)}</span>
            <div className="quantity">
              <button
                aria-label={`Decrease ${i.name}`}
                disabled={action.busy}
                onClick={() => change(i.id, i.quantity - 1)}
              >
                <Minus size={13} />
              </button>
              <span>{i.quantity}</span>
              <button
                aria-label={`Increase ${i.name}`}
                disabled={
                  action.busy ||
                  i.quantity >= Math.min(config.checkout.maxQuantityPerSku, i.available)
                }
                onClick={() => change(i.id, i.quantity + 1)}
              >
                <Plus size={13} />
              </button>
            </div>
            {!i.purchasable && <Notice>This item is unavailable.</Notice>}
          </div>
          <button
            className="icon-button"
            aria-label={`Remove ${i.name}`}
            disabled={action.busy}
            onClick={() => change(i.id, 0)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </>
  );
}
export function StoreLayout() {
  const { config, user, cart, setMarket, locale, setLocale } = useStore(),
    [menu, setMenu] = useState(false),
    dialog = useRef<HTMLDialogElement>(null),
    location = useLocation(),
    navigate = useNavigate(),
    action = useAction();
  useEffect(() => {
    setMenu(false);
    dialog.current?.close();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname, location.search]);
  const count = cart.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <div
      className="store-shell"
      style={Object.fromEntries(Object.entries(config.theme).map(([k, v]) => [`--${k}`, v]))}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="store-header">
        <Logo />
        <nav className={menu ? 'mobile-open' : ''} aria-label="Main navigation">
          {config.navigation.map((n) => (
            <Link key={n.href} to={n.href}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link
            className="icon-button"
            aria-label="Your account"
            to={user?.role === 'ADMIN' ? '/admin' : user ? '/account' : '/sign-in'}
          >
            <UserRound size={18} />
          </Link>
          <button
            className="bag-button"
            data-cart-target
            onClick={() => dialog.current?.showModal()}
            aria-label={`Open bag, ${count} items`}
          >
            <ShoppingBag size={15} />
            <span>{config.messages[locale]?.bag ?? 'Bag'}</span>
            <b>{count}</b>
          </button>
          <button
            className="icon-button menu-toggle"
            aria-label="Toggle menu"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>
      <main id="main">
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="store-footer">
        <div>
          <Logo />
          <p>{config.brand.tagline}</p>
        </div>
        <nav aria-label="Footer">
          {['shipping', 'returns', 'privacy', 'terms'].map((k) => (
            <Link key={k} to={`/policies/${k}`}>
              {k === 'shipping' ? 'Delivery' : k[0].toUpperCase() + k.slice(1)}
            </Link>
          ))}
          <Link to="/contact">Contact</Link>
          <Link to="/order-access">Track an order</Link>
          {user?.role === 'ADMIN' && <Link to="/admin">Admin</Link>}
        </nav>
        <div className="market-controls">
          <label>
            Region
            <select
              aria-label="Store region"
              value={cart.marketId}
              onChange={(e) => action.run(() => setMarket(e.target.value))}
            >
              {config.markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.country} · {m.currency}
                </option>
              ))}
            </select>
          </label>
          <label>
            Language
            <select
              aria-label="Language"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
            >
              {config.locales.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
        </div>
        <Notice>{action.error}</Notice>
        <small>
          © {new Date().getFullYear()} {config.brand.name}. Considered objects. Everyday joy.
          {config.demo && ' Demonstration store.'}
        </small>
      </footer>
      <dialog
        ref={dialog}
        className="bag-dialog"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="drawer-heading">
          <div>
            <span className="eyebrow">Your good things</span>
            <h2>
              Your bag <small>({count})</small>
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close bag"
            onClick={() => dialog.current?.close()}
          >
            <X />
          </button>
        </div>
        {count ? (
          <>
            <div className="drawer-lines">
              <CartLines />
            </div>
            <div className="drawer-bottom">
              <BagTotals />
              <p className="muted">Delivery and taxes confirmed at checkout.</p>
              <button
                className="button wide"
                onClick={() => {
                  dialog.current?.close();
                  navigate('/checkout');
                }}
              >
                Continue to checkout <ArrowUpRight size={16} />
              </button>
              <Link to="/bag" onClick={() => dialog.current?.close()} className="text-link">
                View your bag
              </Link>
            </div>
          </>
        ) : (
          <Empty title="Room for something lovely." />
        )}
      </dialog>
    </div>
  );
}

export function Toast() {
  const { toast, dismiss } = useStore();
  const location = useLocation();
  return toast ? (
    <div className="toast" role="status">
      <span className="toast-check">
        <Check size={14} />
      </span>
      {toast}
      {!location.pathname.startsWith('/admin') && <Link to="/bag">View bag</Link>}
      <button aria-label="Dismiss notification" onClick={dismiss}>
        <X size={14} />
      </button>
    </div>
  ) : null;
}
