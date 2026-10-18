import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, LockKeyhole, Truck } from 'lucide-react';
import { useStore } from '../app/Store.js';
import { api, send } from '../lib/api.js';
import { formValues, useAction } from '../lib/hooks.js';
import type { Address, Cart, Order, Quote } from '../lib/types.js';
import { CartLines } from '../components/StoreLayout.js';
import { Empty, Field, Notice, PageTitle } from '../components/UI.js';
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
  const { cart, money, updateCart } = useStore(),
    action = useAction();
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
            <div className="split">
              <span>Subtotal</span>
              <strong>{money(cart.subtotalMinor)}</strong>
            </div>
            <form
              className="coupon-form"
              onSubmit={(e) => {
                e.preventDefault();
                const d = formValues(e.currentTarget);
                action.run(async () =>
                  updateCart(await send<Cart>('/cart/coupon', { code: d.code })),
                );
              }}
            >
              <input
                name="code"
                aria-label="Promotion code"
                placeholder="Promotion code"
                defaultValue={cart.couponCode ?? ''}
              />
              <button className="button outline" disabled={action.busy}>
                Apply
              </button>
            </form>
            {cart.couponCode && (
              <button
                className="text-link"
                onClick={() =>
                  action.run(async () =>
                    updateCart(await api<Cart>('/cart/coupon', { method: 'DELETE' })),
                  )
                }
              >
                Remove {cart.couponCode}
              </button>
            )}
            <Notice>{action.error}</Notice>
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
  const { config, user, cart, money, refresh } = useStore(),
    navigate = useNavigate(),
    action = useAction(),
    [quote, setQuote] = useState<Quote | null>(null),
    key = useRef(crypto.randomUUID());
  const market = config.markets.find((m) => m.id === cart.marketId)!;
  async function review(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = formValues(e.currentTarget);
    const { contactEmail, _payment, ...shippingAddress } = d;
    await action.run(async () => {
      setQuote(
        await send<Quote>('/checkout/quotes', {
          contactEmail,
          shippingAddress,
          shippingMethodId: 'standard',
        }),
      );
      key.current = crypto.randomUUID();
    });
  }
  async function order() {
    if (!quote) return;
    await action.run(async () => {
      const o = await send<Order>(
        '/checkout/orders',
        { quoteId: quote.id, paymentMethod: 'COD' },
        'POST',
        { 'Idempotency-Key': key.current },
      );
      await refresh();
      navigate(`/orders/${o.id}?confirmed=1`);
    });
  }
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
              <h2>{quote ? 'Ready to make it yours?' : 'Where should we send it?'}</h2>
              <span className="step-pill">{quote ? '2' : '1'} / 2</span>
            </div>
            {!user && (
              <p className="muted">
                Checking out as a guest.{' '}
                <Link className="text-link" to="/sign-in?next=/checkout">
                  Sign in instead
                </Link>
              </p>
            )}
            <form
              onSubmit={review}
              onChange={() => {
                if (quote) setQuote(null);
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
              <Notice>{action.error}</Notice>
              {!quote && (
                <button className="button wide" disabled={action.busy} type="submit">
                  {action.busy ? 'Checking your order…' : 'Review order'}
                  <ArrowRight size={16} />
                </button>
              )}
            </form>
            {quote && (
              <div className="quote-confirm">
                <Notice kind="success">
                  Delivery and prices confirmed. Pay {money(quote.totals.totalMinor)} on delivery.
                </Notice>
                <p>
                  By placing your order, you agree to our <Link to="/policies/terms">terms</Link>{' '}
                  and <Link to="/policies/privacy">privacy policy</Link>.
                </p>
                <button className="button wide" disabled={action.busy} onClick={order}>
                  {action.busy ? 'Placing your order…' : 'Place cash on delivery order'}
                  <Check size={16} />
                </button>
              </div>
            )}
          </section>
          <aside className="panel summary-panel">
            <h2>Order summary</h2>
            <div className="summary-items">
              {cart.items.map((i) => (
                <div className="split" key={i.id}>
                  <span>
                    {i.name} <small>× {i.quantity}</small>
                  </span>
                  <span>{money(Number(i.unitPriceMinor) * i.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="split">
              <span>Subtotal</span>
              <span>{money(cart.subtotalMinor)}</span>
            </div>
            {quote ? (
              <>
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
