import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../app/Store.js';
import { api, send, ApiError } from '../../lib/api.js';
import { formValues, useAction, useResource } from '../../lib/hooks.js';
import type { Content, Coupon, Inventory, MediaAsset, ReturnRequest } from '../../lib/types.js';
import { useAdminList, AdminListTools, AdminPagination } from '../../components/AdminList.js';
import { Badge, Empty, Field, Loading, Notice, PageTitle } from '../../components/UI.js';
export function InventoryPage() {
  const list = useAdminList<Inventory>('/admin/inventory'),
    { data, loading, error, reload, setData } = list,
    action = useAction(),
    { notify } = useStore();
  return (
    <>
      <PageTitle eyebrow="Room for the good things" title="Inventory" />
      <AdminListTools list={list} label="Inventory" />
      <Notice>{error || action.error}</Notice>
      {loading && !data ? (
        <Loading variant="table" />
      ) : (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Object</th>
                <th>On hand</th>
                <th>Allocated</th>
                <th>Available</th>
                <th>Stock adjustment</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.variant.product.name}</strong>
                    <small>{i.variant.sku}</small>
                    <details>
                      <summary>Recent movements</summary>
                      {i.movements.map((m) => (
                        <p key={m.id}>
                          {m.reason}: {m.deltaOnHand > 0 ? '+' : ''}
                          {m.deltaOnHand} on hand, {m.deltaAllocated > 0 ? '+' : ''}
                          {m.deltaAllocated} allocated
                        </p>
                      ))}
                    </details>
                  </td>
                  <td>{i.onHand}</td>
                  <td>{i.allocated}</td>
                  <td>
                    <Badge>{i.onHand - i.allocated}</Badge>
                  </td>
                  <td>
                    <form
                      className="inline-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget,
                          d = formValues(form);
                        action.run(async () => {
                          try {
                            const updated = await send<Inventory>(
                              `/admin/inventory/${i.id}/adjustments`,
                              {
                                delta: Number(d.delta),
                                reason: d.reason,
                                version: i.version,
                              },
                            );
                            setData(
                              (rows) =>
                                rows?.map((row) => (row.id === updated.id ? updated : row)) ?? null,
                            );
                            form.reset();
                            notify('Stock adjusted.');
                          } catch (error) {
                            if (error instanceof ApiError && error.code === 'VERSION_CONFLICT')
                              reload();
                            throw error;
                          }
                        });
                      }}
                    >
                      <input
                        aria-label={`Quantity adjustment for ${i.variant.sku}`}
                        type="number"
                        name="delta"
                        placeholder="+ / − units"
                        min="-10000"
                        max="10000"
                        required
                      />
                      <input
                        aria-label={`Adjustment reason for ${i.variant.sku}`}
                        name="reason"
                        minLength={5}
                        placeholder="Reason"
                        required
                      />
                      <button className="button outline" disabled={action.busy}>
                        Apply
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AdminPagination list={list} />
    </>
  );
}
export function ReturnsPage() {
  const list = useAdminList<ReturnRequest>('/admin/returns'),
    { data, loading, error, reload } = list,
    action = useAction(),
    { notify } = useStore();
  return (
    <>
      <PageTitle eyebrow="Thoughtful aftercare" title="Returns" />
      <AdminListTools list={list} label="Returns" />
      <Notice>{error || action.error}</Notice>
      {loading && !data ? (
        <Loading variant="table" />
      ) : data?.length ? (
        data.map((r) => (
          <section key={r.id} className="panel form-panel">
            <div className="split">
              <Link className="text-link" to={`/admin/orders/${r.orderId}`}>
                {r.order?.number}
              </Link>
              <Badge>{r.status}</Badge>
            </div>
            <p>{r.reason}</p>
            <ul>
              {r.items.map((i) => (
                <li key={i.orderItemId}>
                  {r.order?.items.find((x) => x.id === i.orderItemId)?.name} × {i.quantity}
                </li>
              ))}
            </ul>
            {['REQUESTED', 'APPROVED'].includes(r.status) ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = formValues(e.currentTarget);
                  action.run(async () => {
                    await send(
                      `/admin/returns/${r.id}/${r.status === 'REQUESTED' ? 'decisions' : 'receipts'}`,
                      r.status === 'REQUESTED'
                        ? d
                        : { resolution: d.resolution, restock: d.restock === 'on' },
                    );
                    reload();
                    notify('Return updated.');
                  });
                }}
              >
                {r.status === 'REQUESTED' ? (
                  <Field label="Decision">
                    <select name="status">
                      <option value="APPROVED">Approve return</option>
                      <option value="REJECTED">Reject return</option>
                    </select>
                  </Field>
                ) : (
                  <label className="checkbox">
                    <input name="restock" type="checkbox" defaultChecked />
                    Returned items inspected and suitable for restocking
                  </label>
                )}
                <Field label="Resolution / instructions">
                  <textarea name="resolution" minLength={3} required />
                </Field>
                <button className="button" disabled={action.busy}>
                  {r.status === 'REQUESTED' ? 'Save decision' : 'Confirm items received'}
                </button>
              </form>
            ) : (
              <p>{r.resolution}</p>
            )}
            <p className="muted">
              Receiving a return does not issue a refund. Record the completed payout on the order
              page.
            </p>
          </section>
        ))
      ) : (
        <Empty title="No return requests." />
      )}
      <AdminPagination list={list} />
    </>
  );
}
export function ContentPage() {
  const list = useAdminList<Content>('/admin/content'),
    { data, loading, error, reload } = list,
    [edit, setEdit] = useState<Content | null>(null),
    action = useAction(),
    { notify } = useStore();
  return (
    <>
      <PageTitle eyebrow="The story of your store" title="Storefront content" />
      <AdminListTools list={list} label="Content" />
      <Notice>{error || action.error}</Notice>
      <div className="admin-detail-grid">
        <section className="panel table-wrap">
          {loading && !data ? (
            <Loading variant="table" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Revision</th>
                  <th>Publication</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {data?.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button className="text-link" onClick={() => setEdit(c)}>
                        {c.title || c.key}
                      </button>
                      <small>{c.key}</small>
                    </td>
                    <td>{c.revision}</td>
                    <td>
                      <Badge>{c.published ? 'Published' : 'Draft'}</Badge>
                    </td>
                    <td>
                      <button
                        className="text-link"
                        disabled={c.published || action.busy}
                        onClick={() =>
                          action.run(async () => {
                            await send(`/admin/content/${c.id}/publish`);
                            reload();
                            notify('Content published.');
                          })
                        }
                      >
                        {c.published ? 'Live' : 'Publish'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="panel form-panel">
          <h2>{edit ? 'Create next revision' : 'Draft a page'}</h2>
          <form
            key={edit?.id ?? 'new'}
            onSubmit={(e) => {
              e.preventDefault();
              const d = formValues(e.currentTarget);
              action.run(async () => {
                await send('/admin/content', d);
                reload();
                notify('Draft saved. Publish it when ready.');
              });
            }}
          >
            <Field label="Page key">
              <input
                name="key"
                pattern="[a-z0-9-]+"
                placeholder="shipping, returns, home…"
                defaultValue={edit?.key}
                required
              />
            </Field>
            <Field label="Title">
              <input name="title" defaultValue={edit?.title} required />
            </Field>
            <Field label="Body (plain text)">
              <textarea name="body" rows={10} defaultValue={edit?.body} required />
            </Field>
            <button className="button" disabled={action.busy}>
              Save draft
            </button>
            {edit && (
              <button className="text-link" type="button" onClick={() => setEdit(null)}>
                New page
              </button>
            )}
          </form>
          <p className="muted">
            Publishing an earlier revision restores that version. Content is rendered as text to
            prevent injected scripts.
          </p>
        </section>
      </div>
      <AdminPagination list={list} />
    </>
  );
}
export function CouponsPage() {
  const list = useAdminList<Coupon>('/admin/coupons'),
    { data, loading, error, reload } = list,
    [edit, setEdit] = useState<Coupon | null>(null),
    action = useAction(),
    { config, notify, money } = useStore();
  return (
    <>
      <PageTitle eyebrow="A little extra welcome" title="Promotions" />
      <AdminListTools list={list} label="Coupons" />
      <Notice>{error || action.error}</Notice>
      <div className="admin-detail-grid">
        <section className="panel table-wrap">
          {loading && !data ? (
            <Loading variant="table" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Minimum</th>
                  <th>Uses</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button className="text-link" onClick={() => setEdit(c)}>
                        {c.code}
                      </button>
                    </td>
                    <td>{c.percent}%</td>
                    <td>{money(c.minimumMinor, c.currency)}</td>
                    <td>
                      {c.used} / {c.maxUses}
                    </td>
                    <td>
                      <Badge>{c.active ? 'Active' : 'Disabled'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="panel form-panel">
          <h2>{edit ? 'Edit promotion' : 'Create promotion'}</h2>
          <form
            key={edit?.id ?? 'new'}
            onSubmit={(e) => {
              e.preventDefault();
              const d = formValues(e.currentTarget);
              action.run(async () => {
                await send(
                  edit ? `/admin/coupons/${edit.id}` : '/admin/coupons',
                  {
                    ...d,
                    percent: Number(d.percent),
                    maxUses: Number(d.maxUses),
                    active: d.active === 'on',
                    expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString() : null,
                  },
                  edit ? 'PATCH' : 'POST',
                );
                reload();
                notify('Promotion saved.');
              });
            }}
          >
            <Field label="Code">
              <input name="code" minLength={3} defaultValue={edit?.code} required />
            </Field>
            <div className="form-grid">
              <Field label="Discount percent">
                <input
                  name="percent"
                  type="number"
                  min="1"
                  max="100"
                  defaultValue={edit?.percent ?? 10}
                  required
                />
              </Field>
              <Field label="Maximum uses">
                <input
                  name="maxUses"
                  type="number"
                  min="1"
                  defaultValue={edit?.maxUses ?? 100}
                  required
                />
              </Field>
              <Field label="Minimum subtotal (minor units)">
                <input
                  name="minimumMinor"
                  type="number"
                  min="0"
                  defaultValue={edit?.minimumMinor ?? 0}
                  required
                />
              </Field>
              <Field label="Currency">
                <select name="currency" defaultValue={edit?.currency}>
                  {config.currencies.map((c) => (
                    <option key={c.code}>{c.code}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Expires (optional)">
              <input
                name="expiresAt"
                type="datetime-local"
                defaultValue={edit?.expiresAt?.slice(0, 16)}
              />
            </Field>
            <label className="checkbox">
              <input name="active" type="checkbox" defaultChecked={edit?.active ?? true} />
              Active
            </label>
            <button className="button" disabled={action.busy}>
              Save promotion
            </button>
            {edit && (
              <button className="text-link" type="button" onClick={() => setEdit(null)}>
                New promotion
              </button>
            )}
          </form>
        </section>
      </div>
      <AdminPagination list={list} />
    </>
  );
}
interface Review {
  id: string;
  product: { name: string };
  user: { name: string };
  rating: number;
  body: string;
  published: boolean;
}
export function ReviewsPage() {
  const list = useAdminList<Review>('/admin/reviews'),
    { data, loading, error, reload } = list,
    action = useAction();
  return (
    <>
      <PageTitle eyebrow="At home with your objects" title="Reviews" />
      <AdminListTools list={list} label="Reviews" />
      <Notice>{error || action.error}</Notice>
      {loading && !data ? (
        <Loading variant="table" />
      ) : data?.length ? (
        data.map((r) => (
          <section className="panel form-panel" key={r.id}>
            <div className="split">
              <h3>{r.product.name}</h3>
              <Badge>{r.published ? 'Published' : 'Pending'}</Badge>
            </div>
            <span>{'★'.repeat(r.rating)}</span>
            <p>{r.body}</p>
            <small>{r.user.name} · Verified purchase</small>
            <button
              className="button outline"
              disabled={action.busy}
              onClick={() =>
                action.run(async () => {
                  await send(`/admin/reviews/${r.id}`, { published: !r.published }, 'PATCH');
                  reload();
                })
              }
            >
              {r.published ? 'Hide review' : 'Publish review'}
            </button>
          </section>
        ))
      ) : (
        <Empty title="No customer reviews yet." />
      )}
      <AdminPagination list={list} />
    </>
  );
}
export function MediaPage() {
  const list = useAdminList<MediaAsset>('/admin/media'),
    { data, loading, error, reload } = list,
    action = useAction(),
    { notify } = useStore();
  return (
    <>
      <PageTitle eyebrow="Show the little details" title="Media library" />
      <section className="panel form-panel">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              file = new FormData(form).get('file') as File;
            action.run(async () => {
              await api('/admin/media', {
                method: 'POST',
                headers: {
                  'Content-Type': file.type,
                  'X-File-Name': encodeURIComponent(file.name),
                },
                body: file,
              });
              form.reset();
              reload();
              notify('Image uploaded.');
            });
          }}
        >
          <Field label="Product photo (JPEG, PNG or WebP, up to 2 MB)">
            <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
          </Field>
          <button className="button" disabled={action.busy}>
            Upload image
          </button>
        </form>
        <AdminListTools list={list} label="Media" />
        <Notice>{error || action.error}</Notice>
      </section>
      {loading && !data ? (
        <Loading variant="table" />
      ) : (
        <div className="media-grid">
          {data?.map((m) => (
            <article className="panel" key={m.id}>
              <img src={`${m.url}?size=card`} alt={m.name} loading="lazy" />
              <div>
                <strong>{m.name}</strong>
                <small>{Math.round(m.size / 1024)} KB</small>
                <label>
                  Image URL
                  <input readOnly value={m.url} onFocus={(e) => e.target.select()} />
                </label>
                <button
                  className="text-link"
                  onClick={() =>
                    action.run(async () => {
                      await navigator.clipboard.writeText(m.url);
                      notify('Image URL copied.');
                    })
                  }
                >
                  Copy URL
                </button>
                <button
                  className="text-link danger"
                  disabled={action.busy}
                  onClick={() =>
                    action.run(async () => {
                      await api(`/admin/media/${m.id}`, { method: 'DELETE' });
                      reload();
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <AdminPagination list={list} />
    </>
  );
}
interface Audit {
  id: string;
  action: string;
  target: string;
  actorId: string;
  createdAt: string;
  details: unknown;
}
export function AuditPage() {
  const list = useAdminList<Audit>('/admin/audit'),
    { data, loading, error } = list;
  return (
    <>
      <PageTitle eyebrow="Accountable operations" title="Audit trail" />
      <AdminListTools list={list} label="Audit" />
      <Notice>{error}</Notice>
      {loading && !data ? (
        <Loading variant="table" />
      ) : (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((a) => (
                <tr key={a.id}>
                  <td>
                    {new Date(a.createdAt).toLocaleString()}
                    <small>{a.actorId?.slice(0, 8)}</small>
                  </td>
                  <td>{a.action}</td>
                  <td>
                    <code>{a.target}</code>
                  </td>
                  <td>
                    <code>{JSON.stringify(a.details)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AdminPagination list={list} />
    </>
  );
}
interface Job {
  id: string;
  type: string;
  status: string;
  attempts: number;
  error: string | null;
  createdAt: string;
  payload: unknown;
}
export function NotificationsPage() {
  const list = useAdminList<Job>('/admin/notifications'),
    { data, loading, error, reload } = list,
    action = useAction();
  return (
    <>
      <PageTitle eyebrow="Keep customers in the loop" title="Notifications" />
      <p className="muted">
        Email delivery uses the separate outbox worker. Configure SMTP before a live launch.
      </p>
      <AdminListTools list={list} label="Notifications" />
      <Notice>{error || action.error}</Notice>
      {loading && !data ? (
        <Loading variant="table" />
      ) : data?.length ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Type</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.map((j) => (
                <tr key={j.id}>
                  <td>{new Date(j.createdAt).toLocaleString()}</td>
                  <td>{j.type}</td>
                  <td>
                    <Badge>{j.status}</Badge>
                  </td>
                  <td>{j.attempts}</td>
                  <td>
                    {j.error}
                    <details>
                      <summary>Payload</summary>
                      <pre>{JSON.stringify(j.payload, null, 2)}</pre>
                    </details>
                    {j.status === 'FAILED' && (
                      <button
                        className="text-link"
                        disabled={action.busy}
                        onClick={() =>
                          action.run(async () => {
                            await send(`/admin/notifications/${j.id}/retry`);
                            reload();
                          })
                        }
                      >
                        Retry delivery
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No notifications queued." />
      )}
      <AdminPagination list={list} />
    </>
  );
}
interface SettingsData {
  config: import('../../../../backend/src/config.js').StoreConfig;
  integrations: { email: boolean; payment: string; databaseBranch: string };
  message: string;
}
export function SettingsPage() {
  const { data, loading, error, reload } = useResource<SettingsData>('/admin/config'),
    { user, refreshConfig, notify } = useStore(),
    action = useAction();
  const [draft, setDraft] = useState<SettingsData['config'] | null>(null);
  useEffect(() => {
    if (data) setDraft(structuredClone(data.config));
  }, [data]);
  const change = (update: (value: SettingsData['config']) => void) =>
    setDraft((old) => {
      if (!old) return old;
      const next = structuredClone(old);
      update(next);
      return next;
    });
  return (
    <>
      <PageTitle eyebrow="Your store, considered" title="Settings" />
      <Notice>{error || action.error}</Notice>
      {loading && !data ? (
        <Loading variant="form" />
      ) : data && draft ? (
        <>
          <section className="panel form-panel">
            <h2>Services</h2>
            <div className="service-grid">
              <div>
                <strong>Database</strong>
                <Badge>Connected</Badge>
                <small>{data.integrations.databaseBranch}</small>
              </div>
              <div>
                <strong>Payments</strong>
                <Badge>Cash on delivery</Badge>
                <small>Online payment coming soon</small>
              </div>
              <div>
                <strong>Email</strong>
                <Badge>{data.integrations.email ? 'Configured' : 'Setup needed'}</Badge>
              </div>
              <div>
                <strong>Admin security</strong>
                <Badge>{user?.mfaEnabled ? 'MFA enabled' : 'MFA setup needed'}</Badge>
                <Link to="/account/security">Manage security ↗</Link>
              </div>
            </div>
          </section>
          <form
            className="settings-form"
            onSubmit={(event) => {
              event.preventDefault();
              action.run(async () => {
                await send(
                  '/admin/config',
                  { profile: draft, expectedRevision: data.config.revision },
                  'PUT',
                );
                await refreshConfig();
                reload();
                notify('Store settings saved.');
              });
            }}
          >
            <section className="panel form-panel">
              <h2>Store details</h2>
              <div className="form-grid">
                <Field label="Store name">
                  <input
                    required
                    maxLength={80}
                    value={draft.brand.name}
                    onChange={(e) =>
                      change((v) => {
                        v.brand.name = e.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Support email">
                  <input
                    type="email"
                    required
                    value={draft.brand.supportEmail}
                    onChange={(e) =>
                      change((v) => {
                        v.brand.supportEmail = e.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Tagline">
                  <input
                    required
                    maxLength={160}
                    value={draft.brand.tagline}
                    onChange={(e) =>
                      change((v) => {
                        v.brand.tagline = e.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Timezone">
                  <input
                    required
                    value={draft.timezone}
                    onChange={(e) =>
                      change((v) => {
                        v.timezone = e.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Default language">
                  <select
                    value={draft.defaultLocale}
                    onChange={(e) =>
                      change((v) => {
                        v.defaultLocale = e.target.value;
                      })
                    }
                  >
                    {draft.locales.map((locale) => (
                      <option key={locale}>{locale}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Default selling region">
                  <select
                    value={draft.defaultMarketId}
                    onChange={(e) =>
                      change((v) => {
                        v.defaultMarketId = e.target.value;
                      })
                    }
                  >
                    {draft.markets
                      .filter((m) => m.enabled)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.country} · {m.currency}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
              <p className="muted">
                Regions use their own product prices. New countries and currencies require price
                books and delivery setup.
              </p>
            </section>
            <section className="panel form-panel">
              <h2>Homepage</h2>
              <div className="form-grid">
                <Field label="Season label">
                  <input
                    value={draft.home.eyebrow}
                    onChange={(e) =>
                      change((v) => {
                        v.home.eyebrow = e.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Headline">
                  <input
                    required
                    value={draft.home.headline}
                    onChange={(e) =>
                      change((v) => {
                        v.home.headline = e.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Featured product SKU">
                  <input
                    value={draft.home.featuredSku}
                    onChange={(e) =>
                      change((v) => {
                        v.home.featuredSku = e.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Delivery promise">
                  <input
                    value={draft.home.deliveryPromise}
                    onChange={(e) =>
                      change((v) => {
                        v.home.deliveryPromise = e.target.value;
                      })
                    }
                  />
                </Field>
              </div>
            </section>
            <section className="panel form-panel">
              <h2>Delivery</h2>
              <p className="muted">
                Enter amounts in the smallest currency unit, for example 500 for $5.00 in USD.
              </p>
              {draft.shipping.rates.map((rate, index) => (
                <fieldset className="settings-rate" key={`${rate.marketId}-${rate.id}`}>
                  <legend>
                    {rate.label} · {rate.currency}
                  </legend>
                  <div className="form-grid">
                    <Field label={`Delivery fee (${rate.currency})`}>
                      <input
                        type="number"
                        min={0}
                        required
                        value={rate.feeMinor}
                        onChange={(e) =>
                          change((v) => {
                            v.shipping.rates[index].feeMinor = Number(e.target.value);
                          })
                        }
                      />
                    </Field>
                    <Field label={`Free delivery from (${rate.currency})`}>
                      <input
                        type="number"
                        min={0}
                        required
                        value={rate.freeOverMinor}
                        onChange={(e) =>
                          change((v) => {
                            v.shipping.rates[index].freeOverMinor = Number(e.target.value);
                          })
                        }
                      />
                    </Field>
                    <Field label="Minimum delivery days">
                      <input
                        type="number"
                        min={0}
                        required
                        value={rate.estimatedDaysMin}
                        onChange={(e) =>
                          change((v) => {
                            v.shipping.rates[index].estimatedDaysMin = Number(e.target.value);
                          })
                        }
                      />
                    </Field>
                    <Field label="Maximum delivery days">
                      <input
                        type="number"
                        min={0}
                        required
                        value={rate.estimatedDaysMax}
                        onChange={(e) =>
                          change((v) => {
                            v.shipping.rates[index].estimatedDaysMax = Number(e.target.value);
                          })
                        }
                      />
                    </Field>
                  </div>
                </fieldset>
              ))}
            </section>
            <section className="panel form-panel">
              <h2>Orders and returns</h2>
              <div className="form-grid">
                <Field label="Maximum quantity per product">
                  <input
                    type="number"
                    required
                    min={1}
                    max={99}
                    value={draft.checkout.maxQuantityPerSku}
                    onChange={(e) =>
                      change((v) => {
                        v.checkout.maxQuantityPerSku = Number(e.target.value);
                      })
                    }
                  />
                </Field>
                <Field label="Return window (days)">
                  <input
                    type="number"
                    required
                    min={0}
                    value={draft.returns.windowDays}
                    onChange={(e) =>
                      change((v) => {
                        v.returns.windowDays = Number(e.target.value);
                      })
                    }
                  />
                </Field>
                {draft.currencies.map((currency) => (
                  <Field
                    key={currency.code}
                    label={`Maximum COD order (${currency.code}, smallest unit)`}
                  >
                    <input
                      type="number"
                      required
                      min={0}
                      value={draft.checkout.cod.maximumByCurrency[currency.code] ?? 0}
                      onChange={(e) =>
                        change((v) => {
                          v.checkout.cod.maximumByCurrency[currency.code] = Number(e.target.value);
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
            </section>
            <div className="settings-actions">
              <button
                type="button"
                className="button outline"
                disabled={action.busy}
                onClick={() => setDraft(structuredClone(data.config))}
              >
                Discard changes
              </button>
              <button className="button" disabled={action.busy}>
                Save store settings
              </button>
            </div>
          </form>
        </>
      ) : null}
    </>
  );
}
