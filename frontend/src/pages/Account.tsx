import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, Package, ShieldCheck } from 'lucide-react';
import { useStore } from '../app/Store.js';
import { api, send } from '../lib/api.js';
import { formValues, useAction, useResource } from '../lib/hooks.js';
import type { Address, Order } from '../lib/types.js';
import { ProductArt } from '../components/ProductArt.js';
import { Badge, Empty, Field, Loading, Notice, PageTitle } from '../components/UI.js';
import { AddressFields } from './Checkout.js';
export function Account() {
  const { user, config, cart, logout, refresh, notify } = useStore(),
    navigate = useNavigate(),
    orders = useResource<Order[]>(user ? '/orders' : null),
    addresses = useResource<Address[]>(user ? '/account/addresses' : null),
    action = useAction();
  if (!user) return <Navigate to="/sign-in" replace />;
  return (
    <section className="standard-page">
      <PageTitle eyebrow="Your little corner" title={`Welcome home, ${user.name.split(' ')[0]}.`}>
        <button
          className="button outline"
          onClick={() =>
            action.run(async () => {
              await logout();
              navigate('/');
            })
          }
        >
          Sign out
        </button>
      </PageTitle>
      <Notice>{action.error}</Notice>
      <div className="account-grid">
        <section className="panel form-panel">
          <h2>Your details</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action.run(async () => {
                await send('/account', formValues(e.currentTarget), 'PATCH');
                await refresh();
                notify('Your details are updated.');
              });
            }}
          >
            <Field label="Name">
              <input name="name" defaultValue={user.name} required minLength={2} />
            </Field>
            <Field label="Email">
              <input value={user.email} readOnly />
            </Field>
            <p className="muted">
              {user.emailVerified
                ? 'Email verified.'
                : 'A verification link was queued when you joined.'}
            </p>
            <button className="button" disabled={action.busy}>
              Save details
            </button>
          </form>
          <Link className="text-link" to="/forgot-password">
            Change password
          </Link>
          <Link className="text-link" to="/account/security">
            <ShieldCheck size={14} />
            Authenticator security
          </Link>
          {user.role === 'ADMIN' && (
            <Link className="button outline" to="/admin">
              Open store admin ↗
            </Link>
          )}
        </section>
        <section className="panel form-panel">
          <h2>Your orders</h2>
          {orders.loading ? (
            <Loading />
          ) : orders.error ? (
            <Notice>{orders.error}</Notice>
          ) : orders.data?.length ? (
            orders.data.map((o) => (
              <Link className="account-order" to={`/orders/${o.id}`} key={o.id}>
                <span>
                  <strong>{o.number}</strong>
                  <small>
                    {new Date(o.createdAt).toLocaleDateString()} · {o.items.length} objects
                  </small>
                </span>
                <Badge>{o.fulfillment}</Badge>
              </Link>
            ))
          ) : (
            <Empty title="Your first favourite is waiting." />
          )}
        </section>
      </div>
      <section className="panel form-panel address-section">
        <h2>Saved addresses</h2>
        <div className="address-grid">
          {addresses.data?.map((a) => (
            <article key={a.id}>
              <strong>{a.recipient}</strong>
              <p>
                {a.line1}
                <br />
                {a.city}, {a.country}
                <br />
                {a.phone}
              </p>
              <button
                className="text-link"
                disabled={action.busy}
                onClick={() =>
                  action.run(async () => {
                    await api(`/account/addresses/${a.id}`, { method: 'DELETE' });
                    addresses.reload();
                  })
                }
              >
                Remove
              </button>
            </article>
          ))}
        </div>
        <details>
          <summary>Add an address</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              action.run(async () => {
                await send('/account/addresses', formValues(form));
                form.reset();
                addresses.reload();
                notify('Address saved.');
              });
            }}
          >
            <AddressFields country={config.markets.find((m) => m.id === cart.marketId)!.country} />
            <button className="button" disabled={action.busy}>
              Save address
            </button>
          </form>
        </details>
      </section>
    </section>
  );
}
export function Security() {
  const { user, refresh, notify } = useStore(),
    action = useAction(),
    [setup, setSetup] = useState<{ secret: string; token: string; uri: string } | null>(null);
  if (!user) return <Navigate to="/sign-in" replace />;
  return (
    <section className="narrow-page panel">
      <span className="eyebrow">Peace of mind</span>
      <h1>Account security</h1>
      <p>
        Add an authenticator app to protect your account. Production administrators must enable this
        before operating the store.
      </p>
      {user.mfaEnabled ? (
        <Notice kind="success">Your authenticator is enabled.</Notice>
      ) : setup ? (
        <>
          <p>Enter this setup key into your authenticator app. Keep it private.</p>
          <code className="setup-key">{setup.secret}</code>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action.run(async () => {
                await send('/account/mfa/enable', {
                  token: setup.token,
                  code: formValues(e.currentTarget).code,
                });
                await refresh();
                setSetup(null);
                notify('Authenticator enabled.');
              });
            }}
          >
            <Field label="Six-digit authenticator code">
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                required
              />
            </Field>
            <button className="button" disabled={action.busy}>
              Enable authenticator
            </button>
          </form>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const d = formValues(e.currentTarget);
            action.run(async () => setSetup(await send('/account/mfa/setup', d)));
          }}
        >
          <Field label="Confirm your password">
            <input type="password" name="password" autoComplete="current-password" required />
          </Field>
          <button className="button" disabled={action.busy}>
            Set up authenticator
          </button>
        </form>
      )}
      <Notice>{action.error}</Notice>
      <Link className="text-link" to="/account">
        Back to account
      </Link>
    </section>
  );
}
export function OrderDetail() {
  const { id } = useParams(),
    [search] = useSearchParams(),
    { data: o, loading, error, reload } = useResource<Order>(`/orders/${id}`),
    { money, user, notify } = useStore(),
    action = useAction();
  if (loading) return <Loading />;
  if (!o)
    return (
      <section className="standard-page">
        <Notice>{error}</Notice>
        <Link to="/order-access">Request an order access link</Link>
      </section>
    );
  const canCancel = !o.shipment && o.status !== 'CANCELLED',
    canReturn =
      o.fulfillment === 'DELIVERED' &&
      !o.returns?.some((r) => ['REQUESTED', 'APPROVED'].includes(r.status));
  return (
    <section className="standard-page">
      <PageTitle
        eyebrow={search.has('confirmed') ? 'Thank you. Make a little room.' : 'Your good things'}
        title={search.has('confirmed') ? 'Consider it yours.' : `Order ${o.number}`}
      >
        <Badge>{o.status}</Badge>
      </PageTitle>
      {search.has('confirmed') && (
        <div className="confirmation panel">
          <span>
            <Check size={22} />
          </span>
          <div>
            <h2>Order {o.number} is confirmed.</h2>
            <p>
              Pay {money(o.totalMinor, o.currency)} when it arrives. Keep your order number for
              future access.
            </p>
          </div>
        </div>
      )}
      <div className="checkout-grid">
        <section className="panel form-panel">
          <h2>Your objects</h2>
          {o.items.map((i) => (
            <div className="bag-line" key={i.id}>
              <div className="bag-image">
                <ProductArt {...i} />
              </div>
              <div className="bag-info">
                <strong>{i.name}</strong>
                <small>
                  {i.sku} · Quantity {i.quantity}
                </small>
                <span>{money(i.lineTotalMinor, o.currency)}</span>
                {user && o.fulfillment === 'DELIVERED' && (
                  <details>
                    <summary>Leave a review</summary>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const d = formValues(e.currentTarget);
                        action.run(async () => {
                          await send(`/order-items/${i.id}/reviews`, {
                            rating: Number(d.rating),
                            body: d.body,
                          });
                          notify('Thank you. Your review is awaiting moderation.');
                        });
                      }}
                    >
                      <Field label="Rating">
                        <select name="rating">
                          {[5, 4, 3, 2, 1].map((n) => (
                            <option key={n} value={n}>
                              {n} stars
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Your review">
                        <textarea name="body" minLength={10} required />
                      </Field>
                      <button className="button" disabled={action.busy}>
                        Submit review
                      </button>
                    </form>
                  </details>
                )}
              </div>
            </div>
          ))}
          <h3>The journey home</h3>
          <ol className="timeline">
            {o.events?.map((e) => (
              <li key={e.id}>
                <Package size={14} />
                <div>
                  <strong>{e.type.replaceAll('_', ' ')}</strong>
                  <p>{e.message}</p>
                  <small>{new Date(e.createdAt).toLocaleString()}</small>
                </div>
              </li>
            ))}
          </ol>
          {o.shipment && (
            <p>
              <strong>{o.shipment.carrier}</strong> · Tracking {o.shipment.tracking}
            </p>
          )}
        </section>
        <aside className="panel summary-panel">
          <h2>Order details</h2>
          <Badge>{o.fulfillment}</Badge>
          <Badge>{o.paymentStatus}</Badge>
          <p>
            {o.address.recipient}
            <br />
            {o.address.line1}
            <br />
            {o.address.city}, {o.address.country}
            <br />
            {o.address.phone}
          </p>
          <small>{o.email}</small>
          <div className="split total">
            <strong>Total</strong>
            <strong>{money(o.totalMinor, o.currency)}</strong>
          </div>
          <p className="muted">Cash on delivery</p>
          {Number(o.refundedMinor) > 0 && <p>Refunded: {money(o.refundedMinor, o.currency)}</p>}
          {canCancel && (
            <button
              className="button outline wide"
              disabled={action.busy}
              onClick={() =>
                action.run(async () => {
                  if (!confirm('Cancel this order? Your items will be released.')) return;
                  await send(`/orders/${o.id}/cancellations`);
                  reload();
                  notify('Order cancelled.');
                })
              }
            >
              Cancel order
            </button>
          )}
          <Notice>{action.error}</Notice>
        </aside>
      </div>
      {canReturn && (
        <section className="panel form-panel return-section">
          <h2>A different kind of homecoming.</h2>
          <p>
            Request a return for eligible delivered items. The store will review your request and
            arrange the next steps.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = formValues(e.currentTarget);
              const items = o.items
                .map((i) => ({ orderItemId: i.id, quantity: Number(d[i.id] ?? 0) }))
                .filter((i) => i.quantity > 0);
              action.run(async () => {
                await send(`/orders/${o.id}/returns`, { reason: d.reason, items });
                reload();
                notify('Return request sent.');
              });
            }}
          >
            <div className="form-grid">
              {o.items
                .filter((i) => i.quantity > i.returnedQuantity)
                .map((i) => (
                  <Field label={`${i.name} — quantity to return`} key={i.id}>
                    <input
                      type="number"
                      name={i.id}
                      min="0"
                      max={i.quantity - i.returnedQuantity}
                      defaultValue="0"
                    />
                  </Field>
                ))}
            </div>
            <Field label="Reason for return">
              <textarea name="reason" required minLength={5} />
            </Field>
            <button className="button" disabled={action.busy}>
              Request return
            </button>
          </form>
        </section>
      )}
      {o.returns?.map((r) => (
        <section className="panel form-panel" key={r.id}>
          <h3>
            Return request <Badge>{r.status}</Badge>
          </h3>
          <p>{r.reason}</p>
          <p>{r.resolution}</p>
        </section>
      ))}
    </section>
  );
}
