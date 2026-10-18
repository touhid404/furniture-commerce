import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, ArrowUpRight } from 'lucide-react';
import { useStore } from '../../app/Store.js';
import { api, send } from '../../lib/api.js';
import { formValues, useAction, useResource } from '../../lib/hooks.js';
import type { Category, Product } from '../../lib/types.js';
import { ProductArt } from '../../components/ProductArt.js';
import { Badge, Empty, Field, Loading, Notice, PageTitle } from '../../components/UI.js';
export function Products() {
  const [q, setQ] = useState(''),
    { data, loading, error } = useResource<Product[]>('/admin/products'),
    { money } = useStore();
  return (
    <>
      <PageTitle eyebrow="Considered objects" title="Products">
        <Link className="button" to="/admin/products/new">
          <Plus size={16} />
          Add product
        </Link>
      </PageTitle>
      <div className="admin-toolbar">
        <input
          aria-label="Filter products"
          placeholder="Find a product…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="muted">{data?.length ?? 0} objects</span>
      </div>
      <Notice>{error}</Notice>
      {loading ? (
        <Loading />
      ) : data?.length ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th>Category</th>
                <th>Inventory</th>
                <th>Price</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data
                .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link className="product-table-name" to={`/admin/products/${p.id}`}>
                        <span style={{ background: p.background }}>
                          <ProductArt {...p} />
                        </span>
                        <div>
                          <strong>{p.name}</strong>
                          <small>{p.variants[0]?.sku}</small>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <Badge>{p.status}</Badge>
                    </td>
                    <td>{p.category.name}</td>
                    <td>
                      {(p.variants[0]?.inventory?.onHand ?? 0) -
                        (p.variants[0]?.inventory?.allocated ?? 0)}{' '}
                      available
                    </td>
                    <td>
                      {money(
                        p.variants[0]?.prices[0]?.amountMinor ?? 0,
                        p.variants[0]?.prices[0]?.currency,
                      )}
                    </td>
                    <td>
                      <Link aria-label={`Edit ${p.name}`} to={`/admin/products/${p.id}`}>
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="Your collection starts here." />
      )}
    </>
  );
}
export function ProductEditor() {
  const { id } = useParams(),
    isNew = id === 'new',
    resource = useResource<Product>(isNew ? null : `/admin/products/${id}`),
    cats = useResource<Category[]>('/admin/categories'),
    action = useAction(),
    navigate = useNavigate(),
    { notify, config } = useStore();
  if ((!isNew && resource.loading) || cats.loading) return <Loading />;
  if (!isNew && !resource.data) return <Notice>{resource.error}</Notice>;
  const p = resource.data,
    v = p?.variants[0];
  return (
    <>
      <PageTitle eyebrow="Make it a favourite" title={isNew ? 'Add an object' : p!.name}>
        <Link className="button outline" to="/admin/products">
          All products
        </Link>
      </PageTitle>
      <Notice>{action.error || cats.error}</Notice>
      <form
        key={p?.id ?? 'new'}
        className="admin-editor"
        onSubmit={(e) => {
          e.preventDefault();
          const d = formValues(e.currentTarget);
          action.run(async () => {
            const result = await send<Product>(
              isNew ? '/admin/products' : `/admin/products/${id}`,
              {
                ...d,
                onHand: Number(d.onHand),
                featuredRank: Number(d.featuredRank),
                ...(p ? { version: p.version } : {}),
              },
              isNew ? 'POST' : 'PATCH',
            );
            notify('Product saved.');
            navigate(`/admin/products/${result.id}`);
            resource.reload();
          });
        }}
      >
        <section className="panel form-panel">
          <h2>Object details</h2>
          <div className="form-grid">
            <Field label="Name">
              <input name="name" defaultValue={p?.name} minLength={2} required />
            </Field>
            <Field label="URL slug">
              <input name="slug" defaultValue={p?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              rows={5}
              name="description"
              minLength={10}
              defaultValue={p?.description}
              required
            />
          </Field>
          <div className="form-grid">
            <Field label="Materials">
              <textarea name="materials" defaultValue={p?.materials} />
            </Field>
            <Field label="Dimensions">
              <input name="dimensions" defaultValue={p?.dimensions} />
            </Field>
            <Field label="Care">
              <textarea name="care" defaultValue={p?.care} />
            </Field>
            <Field label="Category">
              <select name="categoryId" defaultValue={p?.categoryId} required>
                {cats.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <h3>Product image</h3>
          <Field label="Upload product image to Neon">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                const form = e.currentTarget.form;
                if (!file || !form) return;
                action.run(async () => {
                  const asset = await api<{ url: string }>('/admin/media', {
                    method: 'POST',
                    headers: {
                      'Content-Type': file.type,
                      'X-File-Name': encodeURIComponent(file.name),
                    },
                    body: file,
                  });
                  const input = form.elements.namedItem('imageUrl') as HTMLInputElement;
                  input.value = asset.url;
                  notify('Image uploaded to Neon. Save the product to use it.');
                });
              }}
            />
          </Field>
          <Field label="Image URL (HTTPS or uploaded /media/ path)">
            <input name="imageUrl" defaultValue={p?.imageUrl} />
          </Field>
          <p className="muted">
            Upload a photo in <Link to="/admin/media">Media</Link> and paste its URL here. The
            illustration is used when no image is set.
          </p>
          <div className="form-grid">
            <Field label="Illustration">
              <select name="art" defaultValue={p?.art ?? 'chair'}>
                {['chair', 'lamp', 'pendant', 'sofa', 'table', 'vase', 'textile'].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
            <Field label="Object color">
              <input name="color" type="color" defaultValue={p?.color ?? '#c4cfb4'} />
            </Field>
            <Field label="Background">
              <input name="background" type="color" defaultValue={p?.background ?? '#e0e6d7'} />
            </Field>
            <Field label="Badge">
              <input name="badge" defaultValue={p?.badge} />
            </Field>
          </div>
        </section>
        <section className="panel form-panel">
          <h2>Availability & pricing</h2>
          <Field label="Status">
            <select name="status" defaultValue={p?.status ?? 'DRAFT'}>
              {['DRAFT', 'PUBLISHED', 'ARCHIVED'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="SKU">
            <input name="sku" defaultValue={v?.sku} required minLength={2} />
          </Field>
          <Field label="Finish label">
            <input name="label" defaultValue={v?.label ?? 'Natural finish'} required />
          </Field>
          <Field
            label={`Price in minor units (${config.markets.find((m) => m.id === config.defaultMarketId)!.currency})`}
          >
            <input
              name="priceMinor"
              type="number"
              min="0"
              defaultValue={
                v?.prices.find((x) => x.marketId === config.defaultMarketId)?.amountMinor ?? 0
              }
              required
            />
          </Field>
          <Field label="Units on hand">
            <input
              name="onHand"
              type="number"
              min={v?.inventory?.allocated ?? 0}
              defaultValue={v?.inventory?.onHand ?? 0}
              required
            />
          </Field>
          <small className="muted">
            {v?.inventory?.allocated ?? 0} allocated to unshipped orders.
          </small>
          <Field label="Featured sort rank">
            <input
              name="featuredRank"
              type="number"
              min="0"
              max="1000"
              defaultValue={p?.featuredRank ?? 0}
            />
          </Field>
          <button className="button wide" disabled={action.busy}>
            {action.busy ? 'Saving…' : 'Save product'}
          </button>
          {p && p.status !== 'ARCHIVED' && (
            <button
              className="text-link danger"
              type="button"
              disabled={action.busy}
              onClick={() =>
                action.run(async () => {
                  if (!confirm('Archive this product?')) return;
                  await send(`/admin/products/${id}/archive`);
                  resource.reload();
                  notify('Product archived.');
                })
              }
            >
              Archive product
            </button>
          )}
        </section>
      </form>
      {p && <PriceBooks product={p} onSaved={resource.reload} />}
    </>
  );
}
function PriceBooks({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const { config, notify } = useStore(),
    action = useAction();
  return (
    <section className="panel form-panel">
      <h2>Market price books</h2>
      <p className="muted">
        Set explicit prices for each enabled market. Prices are never converted automatically.
      </p>
      {product.variants.map((v) => (
        <div key={v.id}>
          <div className="split">
            <h3>
              {v.sku} · {v.label}
            </h3>
            <button
              className="text-link"
              disabled={action.busy}
              onClick={() =>
                action.run(async () => {
                  await send(`/admin/variants/${v.id}`, { active: !v.active }, 'PATCH');
                  onSaved();
                })
              }
            >
              {v.active ? 'Disable SKU' : 'Enable SKU'}
            </button>
          </div>
          {config.markets.map((m) => (
            <form
              className="price-book-form"
              key={m.id}
              onSubmit={(e) => {
                e.preventDefault();
                const d = formValues(e.currentTarget);
                action.run(async () => {
                  await send(
                    `/admin/variants/${v.id}/prices`,
                    { marketId: m.id, currency: m.currency, amountMinor: d.amountMinor },
                    'PUT',
                  );
                  notify('Market price saved.');
                });
              }}
            >
              <span>
                {m.country} · {m.currency}
              </span>
              <input
                aria-label={`${m.id} price in minor units`}
                name="amountMinor"
                type="number"
                min="0"
                defaultValue={v.prices.find((p) => p.marketId === m.id)?.amountMinor ?? 0}
                required
              />
              <button className="button outline" disabled={action.busy}>
                Save price
              </button>
            </form>
          ))}
        </div>
      ))}
      <details>
        <summary>Add a finish / SKU</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const d = formValues(e.currentTarget);
            action.run(async () => {
              await send(`/admin/products/${product.id}/variants`, {
                ...d,
                onHand: Number(d.onHand),
              });
              notify('SKU added.');
              onSaved();
            });
          }}
        >
          <div className="form-grid">
            <Field label="New SKU">
              <input name="sku" required minLength={2} />
            </Field>
            <Field label="Finish name">
              <input name="label" required minLength={2} />
            </Field>
            <Field label="Opening stock">
              <input name="onHand" type="number" min="0" defaultValue="0" required />
            </Field>
            <Field label="Default market price (minor units)">
              <input name="priceMinor" type="number" min="0" defaultValue="0" required />
            </Field>
          </div>
          <button className="button" disabled={action.busy}>
            Add SKU
          </button>
        </form>
      </details>
      <Notice>{action.error}</Notice>
    </section>
  );
}
export function Categories() {
  const { data, loading, error, reload } = useResource<Category[]>('/admin/categories'),
    [edit, setEdit] = useState<Category | null>(null),
    action = useAction(),
    { notify } = useStore();
  return (
    <>
      <PageTitle eyebrow="A place for every object" title="Categories" />
      <Notice>{error || action.error}</Notice>
      <div className="admin-detail-grid">
        <section className="panel table-wrap">
          {loading ? (
            <Loading />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {data?.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button className="text-link" onClick={() => setEdit(c)}>
                        {c.name}
                      </button>
                      <small>{c.slug}</small>
                    </td>
                    <td>{c._count?.products ?? 0}</td>
                    <td>
                      <Badge>{c.active ? 'Active' : 'Hidden'}</Badge>
                    </td>
                    <td>
                      <button
                        className="text-link danger"
                        disabled={action.busy}
                        onClick={() =>
                          action.run(async () => {
                            if (!confirm('Delete this empty category?')) return;
                            await api(`/admin/categories/${c.id}`, { method: 'DELETE' });
                            reload();
                            notify('Category deleted.');
                          })
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="panel form-panel">
          <h2>{edit ? 'Edit category' : 'Add category'}</h2>
          <form
            key={edit?.id ?? 'new'}
            onSubmit={(e) => {
              e.preventDefault();
              const d = formValues(e.currentTarget);
              const form = e.currentTarget;
              action.run(async () => {
                await send(
                  edit ? `/admin/categories/${edit.id}` : '/admin/categories',
                  { ...d, active: d.active === 'on', sortOrder: Number(d.sortOrder) },
                  edit ? 'PATCH' : 'POST',
                );
                setEdit(null);
                form.reset();
                reload();
                notify('Category saved.');
              });
            }}
          >
            <Field label="Name">
              <input name="name" defaultValue={edit?.name} required minLength={2} />
            </Field>
            <Field label="Slug">
              <input name="slug" defaultValue={edit?.slug} pattern="[a-z0-9-]+" required />
            </Field>
            <Field label="Description">
              <textarea name="description" defaultValue={edit?.description} />
            </Field>
            <Field label="Sort order">
              <input
                name="sortOrder"
                type="number"
                min="0"
                max="1000"
                defaultValue={edit?.sortOrder ?? 0}
              />
            </Field>
            <label className="checkbox">
              <input name="active" type="checkbox" defaultChecked={edit?.active ?? true} />
              Visible in store
            </label>
            <button className="button" disabled={action.busy}>
              Save category
            </button>
            {edit && (
              <button type="button" className="text-link" onClick={() => setEdit(null)}>
                Add another
              </button>
            )}
          </form>
        </section>
      </div>
    </>
  );
}
