import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Download, ArrowRight } from 'lucide-react';
import { useStore } from '../../app/Store.js';
import { send } from '../../lib/api.js';
import { formValues, useAction, useResource } from '../../lib/hooks.js';
import type { Order } from '../../lib/types.js';
import { Badge, Empty, Field, Loading, Notice, PageTitle } from '../../components/UI.js';
export function Orders() {
  const [params, setParams] = useSearchParams(),
    [query, setQuery] = useState(params.get('q') ?? ''),
    { data, loading, error } = useResource<Order[]>(`/admin/orders?${params}`),
    { money } = useStore();
  return (
    <>
      <PageTitle eyebrow="The journey home" title="Orders">
        <a className="button outline" href="/api/v1/admin/exports/orders" download>
          <Download size={15} />
          Export CSV
        </a>
      </PageTitle>
      <div className="admin-toolbar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ q: query });
          }}
        >
          <input
            aria-label="Search orders"
            placeholder="Search order or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="icon-button" aria-label="Search">
            <ArrowRight size={16} />
          </button>
        </form>
        <select
          aria-label="Order status"
          value={params.get('status') ?? ''}
          onChange={(e) => setParams({ status: e.target.value })}
        >
          <option value="">All statuses</option>
          {['CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <Notice>{error}</Notice>
      {loading ? (
        <Loading />
      ) : data?.length ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Placed</th>
                <th>Status</th>
                <th>Delivery</th>
                <th>Payment</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link className="text-link" to={`/admin/orders/${o.id}`}>
                      {o.number}
                    </Link>
                  </td>
                  <td>
                    {o.address.recipient}
                    <small>{o.email}</small>
                  </td>
                  <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td>
                    <Badge>{o.status}</Badge>
                  </td>
                  <td>
                    <Badge>{o.fulfillment}</Badge>
                  </td>
                  <td>
                    <Badge>{o.paymentStatus}</Badge>
                  </td>
                  <td>{money(o.totalMinor, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No orders in this view." />
      )}
      <div className="pagination">
        <button
          disabled={!params.has('page') || params.get('page') === '1'}
          onClick={() => {
            params.set('page', String(Math.max(1, Number(params.get('page') ?? 1) - 1)));
            setParams(params);
          }}
        >
          Previous
        </button>
        <span>Page {params.get('page') ?? 1}</span>
        <button
          disabled={!data || data.length < 30}
          onClick={() => {
            params.set('page', String(Number(params.get('page') ?? 1) + 1));
            setParams(params);
          }}
        >
          Next
        </button>
      </div>
    </>
  );
}
export function AdminOrder() {
  const { id } = useParams(),
    { data: o, loading, error, reload } = useResource<Order>(`/admin/orders/${id}`),
    { money, notify } = useStore(),
    action = useAction();
  if (loading) return <Loading />;
  if (!o) return <Notice>{error}</Notice>;
  const act = (path: string, data: unknown = {}) =>
    action.run(async () => {
      await send(`/admin/orders/${id}/${path}`, data);
      reload();
      notify('Order updated.');
    });
  return (
    <>
      <PageTitle eyebrow="Order details" title={o.number}>
        <Link to="/admin/orders" className="button outline">
          All orders
        </Link>
      </PageTitle>
      <Notice>{action.error}</Notice>
      <div className="admin-detail-grid">
        <section className="panel form-panel">
          <div className="split">
            <h2>{o.address.recipient}</h2>
            <Badge>{o.status}</Badge>
          </div>
          <p>
            {o.email}
            <br />
            {o.address.line1}, {o.address.city}, {o.address.country}
            <br />
            {o.address.phone}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Object</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td>{i.sku}</td>
                    <td>{i.quantity}</td>
                    <td>{money(i.lineTotalMinor, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="split total">
            <strong>Total</strong>
            <strong>{money(o.totalMinor, o.currency)}</strong>
          </div>
          <h3>Activity</h3>
          <ol className="timeline">
            {o.events.map((e) => (
              <li key={e.id}>
                <span className="live-dot" />
                <div>
                  <strong>{e.type.replaceAll('_', ' ')}</strong>
                  <p>{e.message}</p>
                  <small>{new Date(e.createdAt).toLocaleString()}</small>
                </div>
              </li>
            ))}
          </ol>
          {o.refunds?.map((r) => (
            <p key={r.id}>
              Refund: {money(r.amountMinor, o.currency)} · {r.reference}
            </p>
          ))}
        </section>
        <section className="panel form-panel">
          <h2>Fulfillment</h2>
          <Badge>{o.fulfillment}</Badge>
          <Badge>{o.paymentStatus}</Badge>
          {!o.shipment && o.status !== 'CANCELLED' && (
            <>
              <button
                className="button outline wide"
                disabled={action.busy || o.status === 'PROCESSING'}
                onClick={() => act('processing')}
              >
                Mark as processing
              </button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act('shipments', formValues(e.currentTarget));
                }}
              >
                <h3>Dispatch shipment</h3>
                <Field label="Carrier">
                  <input name="carrier" required minLength={2} />
                </Field>
                <Field label="Tracking reference">
                  <input name="tracking" required minLength={2} />
                </Field>
                <button className="button wide" disabled={action.busy}>
                  Confirm dispatch
                </button>
              </form>
              <button
                className="text-link danger"
                disabled={action.busy}
                onClick={() => {
                  if (confirm('Cancel this order and release inventory?')) act('cancellations');
                }}
              >
                Cancel order
              </button>
            </>
          )}
          {o.shipment && (
            <p>
              {o.shipment.carrier}
              <br />
              Tracking: {o.shipment.tracking}
            </p>
          )}
          {o.fulfillment === 'SHIPPED' && (
            <button className="button wide" disabled={action.busy} onClick={() => act('delivery')}>
              Confirm delivery
            </button>
          )}
          {o.fulfillment === 'DELIVERED' && o.paymentStatus === 'UNPAID' && (
            <button
              className="button wide"
              disabled={action.busy}
              onClick={() => {
                if (confirm('Confirm the cash has been collected?')) act('cod-collections');
              }}
            >
              Record cash collected
            </button>
          )}
          {['PAID', 'PARTIALLY_REFUNDED'].includes(o.paymentStatus) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const d = formValues(e.currentTarget);
                action.run(async () => {
                  await send(
                    `/admin/orders/${id}/refunds`,
                    { ...d, amountMinor: d.amountMinor },
                    'POST',
                    { 'Idempotency-Key': crypto.randomUUID() },
                  );
                  reload();
                  notify('Manual refund recorded.');
                });
              }}
            >
              <h3>Record a manual COD refund</h3>
              <p className="muted">
                Record only after the customer has received the money. This does not transfer funds.
              </p>
              <p>Available: {money(Number(o.totalMinor) - Number(o.refundedMinor), o.currency)}</p>
              <Field label="Refund amount (minor units)">
                <input
                  type="number"
                  name="amountMinor"
                  min="1"
                  max={Number(o.totalMinor) - Number(o.refundedMinor)}
                  required
                />
              </Field>
              <Field label="Payout reference">
                <input name="reference" required minLength={3} />
              </Field>
              <Field label="Reason">
                <textarea name="reason" required minLength={5} />
              </Field>
              <button className="button outline wide" disabled={action.busy}>
                Record completed refund
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
