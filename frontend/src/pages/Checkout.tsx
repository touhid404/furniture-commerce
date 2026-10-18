import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, LockKeyhole, Truck } from 'lucide-react';
import { useStore } from '../app/Store.js';
import { ApiError, send } from '../lib/api.js';
import { formValues, useAction } from '../lib/hooks.js';
import type { Address, Order, Quote } from '../lib/types.js';
import { BagTotals, PromoCodeForm } from '../components/Promotion.js';
import { CartLines } from '../components/StoreLayout.js';
import { Empty, Field, Loading, Notice, PageTitle } from '../components/UI.js';
export function AddressFields({ country, address }: { country: string; address?: Address }) {
  return (
    <div className="form-grid">
      <Field label="Full name">
        <input
          name="recipient"
          autoComplete="shipping name"
          defaultValue={address?.recipient}
          required
          minLength={2}
        />
      </Field>
      <Field label="Phone number">
        <input
          name="phone"
          type="tel"
          autoComplete="shipping tel"
          defaultValue={address?.phone}
          required
          minLength={5}
        />
      </Field>
      <Field label="Street address">
        <input
          name="line1"
          autoComplete="shipping address-line1"
          defaultValue={address?.line1}
          required
          minLength={4}
        />
      </Field>
      <Field label="Apartment, suite, etc. (optional)">
        <input name="line2" autoComplete="shipping address-line2" defaultValue={address?.line2} />
      </Field>
      <Field label="City">
        <input
          name="city"
          autoComplete="shipping address-level2"
          defaultValue={address?.city}
          required
          minLength={2}
        />
      </Field>
      <Field label="State / region">
        <input
          name="region"
          autoComplete="shipping address-level1"
          defaultValue={address?.region}
        />
      </Field>
      <Field label="Postal code">
        <input
          name="postalCode"
          autoComplete="shipping postal-code"
          defaultValue={address?.postalCode}
        />
      </Field>
      <Field label="Country">
        <select
          name="country"
          autoComplete="shipping country"
          defaultValue={address?.country ?? country}
        >
          <option value={country}>
            {new Intl.DisplayNames(['en'], { type: 'region' }).of(country)}
          </option>
        </select>
      </Field>
    </div>
  );
}
export function Bag() {
  const { cart } = useStore();
  return (
    <section className="standard-page">
      <PageTitle eyebrow="A considered collection" title="Your bag" />
      {!cart.items.length ? (
        <Empty title="Room for something lovely." />
      ) : (
        <div className="checkout-grid">
          <section className="panel form-panel">
            <CartLines />
          </section>
          <aside className="panel summary-panel">
            <h2>The good things</h2>
            <BagTotals />
            <PromoCodeForm />
            <p className="muted">
              Delivery and tax are confirmed at checkout. Your items are reserved when your order is
              placed.
            </p>
            <Link to="/checkout" className="button wide">
              Continue to checkout <ArrowRight size={16} />
            </Link>
            <Link to="/shop" className="text-link">
              Keep looking around
            </Link>
          </aside>
        </div>
      )}
    </section>
  );
}
export function Checkout() {
  const { config, user, authReady, cart, money, syncCart, updateCart, purchased } = useStore(),
    navigate = useNavigate(),
    action = useAction(),
    [quote, setQuote] = useState<Quote | null>(null),
    [changes, setChanges] = useState(''),
    [formRevision, setFormRevision] = useState(0),
    [preparing, setPreparing] = useState(false),
    [quoteError, setQuoteError] = useState(''),
    form = useRef<HTMLFormElement>(null),
    prepared = useRef({ version: 0, revision: -1 }),
    reviewedItems = useRef<{ variantId: string; quantity: number }[]>([]),
    reviewedVersion = useRef(0),
    key = useRef(crypto.randomUUID());
  const actions = useRef({ syncCart, updateCart });
  actions.current = { syncCart, updateCart };
  const market = config.markets.find((m) => m.id === cart.marketId)!;
  useEffect(() => {
    setQuote(null);
    if (!user || user.role === 'ADMIN' || !cart.items.length || !form.current?.checkValidity()) {
      setPreparing(false);
      return;
    }
    let active = true;
    setPreparing(true);
    setQuoteError('');
    const timer = setTimeout(async () => {
      try {
        if (
          prepared.current.version !== cart.version ||
          prepared.current.revision !== formRevision
        ) {
          const fresh = await actions.current.syncCart();
          if (!active) return;
          const changed = fresh.items.some((item) => {
            const old = cart.items.find((i) => i.variantId === item.variantId);
            return (
              !old ||
              old.unitPriceMinor !== item.unitPriceMinor ||
              !item.purchasable ||
              item.quantity > item.available
            );
          });
          prepared.current = { version: cart.version + 1, revision: formRevision };
          if (changed)
            setChanges(
              'Prices or availability changed. Review the updated summary before confirming.',
            );
          actions.current.updateCart(fresh, cart.version);
          return; // The new local version starts the quote phase with authoritative items.
        }
        const { contactEmail, _payment, ...shippingAddress } = formValues(form.current!);
        const result = await send<Quote>('/checkout/quotes', {
          contactEmail,
          shippingAddress,
          shippingMethodId:
            config.delivery.find((rate) => rate.marketId === cart.marketId)?.id ?? '',
        });
        if (!active) return;
        reviewedItems.current = cart.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        }));
        reviewedVersion.current = cart.version;
        key.current = crypto.randomUUID();
        setQuote(result);
        setPreparing(false);
      } catch (error) {
        if (active) {
          setQuoteError(error instanceof Error ? error.message : 'We could not check your order.');
          setPreparing(false);
        }
      }
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [formRevision, cart.version, user?.id]);
  useEffect(() => {
    if (!quote) return;
    const timer = setTimeout(
      () => {
        prepared.current.version = 0;
        setFormRevision((v) => v + 1);
      },
      Math.max(1, new Date(quote.expiresAt).getTime() - Date.now() - 1000),
    );
    return () => clearTimeout(timer);
  }, [quote]);
  async function order() {
    if (!quote) return;
    if (cart.version !== reviewedVersion.current) {
      setQuote(null);
      action.setError('Your bag changed. Review the order again.');
      return;
    }
    await action.run(async () => {
      try {
        const o = await send<Order>(
          '/checkout/orders',
          { quoteId: quote.id, paymentMethod: 'COD' },
          'POST',
          { 'Idempotency-Key': key.current },
        );
        purchased(reviewedItems.current);
        navigate(`/orders/${o.id}?confirmed=1`);
      } catch (error) {
        if (
          error instanceof ApiError &&
          ['PRICE_CHANGED', 'QUOTE_EXPIRED', 'STOCK_CHANGED', 'COUPON_INVALID'].includes(error.code)
        ) {
          setQuote(null);
          prepared.current.version = 0;
          setFormRevision((v) => v + 1);
          setChanges(
            'Your order details changed. Review the refreshed total before confirming again.',
          );
        }
        throw error;
      }
    });
  }
  if (!authReady) return <Loading />;
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (!user) return <Navigate to="/sign-in?next=/checkout" replace />;
  return (
    <section className="standard-page">
      <PageTitle eyebrow="Almost home" title="Checkout">
        <span className="secure-label">
          <LockKeyhole size={14} />
          Secure checkout
        </span>
      </PageTitle>
      {!cart.items.length ? (
        <Empty title="Your bag is empty." />
      ) : (
        <div className="checkout-grid">
          <section className="panel form-panel">
            <div className="section-title">
              <h2>Where should we send it?</h2>
            </div>
            <form
              ref={form}
              onSubmit={(event) => {
                event.preventDefault();
                void order();
              }}
              onChange={() => {
                setQuote(null);
                setFormRevision((v) => v + 1);
              }}
            >
              <Field label="Email address">
                <input
                  name="contactEmail"
                  type="email"
                  autoComplete="email"
                  defaultValue={user?.email}
                  required
                />
              </Field>
              <h3>Delivery address</h3>
              <AddressFields country={market.country} />
              <div className="delivery-choice">
                <Truck size={19} />
                <div>
                  <strong>Standard delivery</strong>
                  <small>Cost confirmed in your order summary</small>
                </div>
                <Check size={17} />
              </div>
              <h3>Payment method</h3>
              <label className="payment-option">
                <input
                  type="radio"
                  name="_payment"
                  value="COD"
                  defaultChecked
                  onChange={() => {}}
                />
                <span>
                  <strong>Cash on delivery</strong>
                  <small>Pay when your good things arrive.</small>
                </span>
              </label>
              <div className="coming-soon">
                <LockKeyhole size={16} />
                {config.checkout.onlinePaymentLabel}
              </div>
              <Notice>{changes}</Notice>
              <Notice>{action.error}</Notice>
              <Notice>{quoteError}</Notice>
              {preparing && (
                <p className="muted" role="status">
                  Checking delivery, stock and your final total…
                </p>
              )}
              {!quote && !preparing && !quoteError && (
                <p className="muted">Complete your delivery details to see the final total.</p>
              )}
              {quoteError && (
                <button
                  className="text-link"
                  type="button"
                  onClick={() => {
                    prepared.current.version = 0;
                    setFormRevision((v) => v + 1);
                  }}
                >
                  Recheck totals
                </button>
              )}
              {quote && (
                <Notice kind="success">
                  Delivery and prices confirmed. Pay {money(quote.totals.totalMinor)} on delivery.
                </Notice>
              )}
              <p className="muted">
                By confirming, you agree to our{' '}
                <Link to="/policies/terms" className="text-link">
                  terms
                </Link>{' '}
                and{' '}
                <Link to="/policies/privacy" className="text-link">
                  privacy policy
                </Link>
                .
              </p>
              <button
                className="button wide"
                disabled={action.busy || preparing || !quote}
                type="submit"
              >
                {action.busy ? 'Placing your order…' : 'Confirm order'}
                <Check size={16} />
              </button>
            </form>
          </section>
          <aside className="panel summary-panel">
            <h2>Order summary</h2>
            <div className="summary-items">
              {cart.items.map((i) => (
                <div className="split" key={i.id}>
                  <span>
                    {(!i.purchasable || i.quantity > i.available) && (
                      <strong>Unavailable quantity — </strong>
                    )}
                    {i.name} <small>× {i.quantity}</small>
                  </span>
                  <span>{money(Number(i.unitPriceMinor) * i.quantity)}</span>
                </div>
              ))}
            </div>
            {!quote && (
              <>
                <BagTotals />
                <PromoCodeForm />
              </>
            )}
            {quote ? (
              <>
                <div className="split">
                  <span>Subtotal</span>
                  <span>{money(quote.totals.subtotalMinor)}</span>
                </div>
                <div className="split">
                  <span>Discount</span>
                  <span>−{money(quote.totals.discountMinor)}</span>
                </div>
                <div className="split">
                  <span>Delivery</span>
                  <span>
                    {Number(quote.totals.shippingMinor)
                      ? money(quote.totals.shippingMinor)
                      : 'Complimentary'}
                  </span>
                </div>
                <div className="split">
                  <span>Tax</span>
                  <span>{money(quote.totals.taxMinor)}</span>
                </div>
                <div className="split total">
                  <strong>Total on delivery</strong>
                  <strong>{money(quote.totals.totalMinor)}</strong>
                </div>
              </>
            ) : (
              <p className="muted">Review your address to confirm the final total.</p>
            )}
            <Link to="/bag" className="text-link">
              Edit bag
            </Link>
            <small className="muted">{config.home.deliveryPromise}</small>
          </aside>
        </div>
      )}
    </section>
  );
}
