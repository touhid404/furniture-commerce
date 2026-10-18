import { useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Plus,
  Star,
  Truck,
  ShieldCheck,
  Leaf,
} from 'lucide-react';
import { useStore } from '../app/Store.js';
import { useAction, useResource } from '../lib/hooks.js';
import type { Product } from '../lib/types.js';
import { ProductArt } from '../components/ProductArt.js';
import { Empty, Field, Loading, Notice } from '../components/UI.js';
export function ProductCard({ product: p }: { product: Product }) {
  const { money, add } = useStore(),
    action = useAction(),
    v = p.variants[0],
    navigate = useNavigate();
  return (
    <article className="product-card">
      <div className="product-visual" style={{ background: p.background }}>
        <Link to={`/products/${p.slug}`} className="product-picture" aria-label={`View ${p.name}`}>
          <ProductArt {...p} />
        </Link>
        {p.badge && <span className="product-badge">{p.badge}</span>}
        <button
          className="quick-add"
          aria-label={
            p.variants.length > 1 ? `Choose options for ${p.name}` : `Add ${p.name} to bag`
          }
          disabled={action.busy || !v?.available}
          onClick={() =>
            p.variants.length > 1 ? navigate(`/products/${p.slug}`) : action.run(() => add(v.id))
          }
        >
          {action.busy ? '…' : <Plus size={20} />}
        </button>
      </div>
      <div className="product-caption">
        <div>
          <Link to={`/products/${p.slug}`}>
            <h3>{p.name}</h3>
          </Link>
          <small>
            {p.category.name} · {v?.label}
          </small>
          {p.rating !== null && (
            <div className="rating">
              <Star size={11} fill="currentColor" />
              {p.rating.toFixed(1)} <span>({p.reviewCount})</span>
            </div>
          )}
        </div>
        <span>{v ? money(v.priceMinor) : 'Unavailable'}</span>
      </div>
      <Notice>{action.error}</Notice>
    </article>
  );
}
export function Home() {
  const { config, market, money, add } = useStore(),
    { data, loading, error } = useResource<Product[]>(
      `/products?marketId=${encodeURIComponent(market)}`,
    ),
    action = useAction();
  if (loading) return <Loading />;
  if (error) return <Notice>{error}</Notice>;
  const featured =
    data?.find((p) => p.variants.some((v) => v.sku === config.home.featuredSku)) ?? data?.[0];
  return (
    <>
      <section className="home-bento">
        <div className="hero-copy panel">
          <span className="eyebrow">
            <i className="season-dot" />
            {config.home.eyebrow} · {data?.length} pieces just landed
          </span>
          <h1>{config.home.headline}</h1>
          <div className="hero-copy-bottom">
            <p>
              Thoughtfully made furniture and everyday objects.
              <br />
              For a home that feels a little more like you.
            </p>
            <Link className="button" to="/shop">
              Explore the collection <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
        <Link className="soft-light panel" to="/shop?category=lighting">
          <span className="eyebrow">Lighting</span>
          <ProductArt art="pendant" color="#eee7d7" name="Soft pendant light" />
          <div>
            <h2>Soft light</h2>
            <small>
              Shop lighting <ArrowUpRight size={12} />
            </small>
          </div>
        </Link>
        <Link className="delivery-card panel" to="/policies/shipping">
          <span className="eyebrow">A little reassurance</span>
          <Truck size={28} strokeWidth={1} />
          <h2>Good things, delivered.</h2>
          <p>{config.home.deliveryPromise}</p>
          <div className="delivery-line">
            <span>Made for your everyday.</span>
            <ArrowRight size={18} />
          </div>
        </Link>
        {featured && (
          <div className="hero-product panel" style={{ background: featured.background }}>
            <span className="eyebrow">{featured.badge || 'Considered comfort'}</span>
            <h2>{featured.name}</h2>
            <Link className="hero-art" to={`/products/${featured.slug}`}>
              <ProductArt {...featured} />
            </Link>
            <div className="hero-product-bottom">
              <strong>{money(featured.variants[0].priceMinor)}</strong>
              <Link to={`/products/${featured.slug}`}>Details</Link>
              <button
                className="button"
                disabled={action.busy}
                onClick={() => action.run(() => add(featured.variants[0].id))}
              >
                Add to bag <Plus size={14} />
              </button>
            </div>
            <Notice>{action.error}</Notice>
          </div>
        )}
      </section>
      <section className="collection-section">
        <div className="section-title">
          <div>
            <span className="eyebrow">Good company for your home</span>
            <h2>This week’s favourites</h2>
          </div>
          <Link className="text-link" to="/shop">
            Shop all <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="product-grid">
          {data?.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
      <section className="manifesto panel">
        <Leaf size={30} strokeWidth={1} />
        <span className="eyebrow">Less, but more considered.</span>
        <h2>
          Objects to come home to.
          <br />
          For the moments in between.
        </h2>
        <p>Honest materials. Thoughtful details. A quieter kind of everyday.</p>
        <Link to="/shop" className="button outline">
          Find your favourite <ArrowUpRight size={16} />
        </Link>
      </section>
    </>
  );
}
export function Shop() {
  const { categories, market } = useStore(),
    [search, setSearch] = useSearchParams(),
    [query, setQuery] = useState(search.get('q') ?? '');
  const category = search.get('category') ?? '',
    sort = search.get('sort') ?? 'featured';
  const { data, meta, loading, error } = useResource<Product[]>(
    `/products?marketId=${encodeURIComponent(market)}&${search.toString()}`,
  );
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(search);
    if (v) next.set(k, v);
    else next.delete(k);
    next.delete('page');
    setSearch(next);
  };
  return (
    <section className="shop-page">
      <div className="catalog-heading">
        <div>
          <span className="eyebrow">Most loved</span>
          <h1>This week’s favourites</h1>
          <p>Considered pieces. Everyday companions.</p>
        </div>
        <div className="category-pills">
          <button className={!category ? 'selected' : ''} onClick={() => set('category', '')}>
            All objects
          </button>
          {categories.map((c) => (
            <button
              className={category === c.slug ? 'selected' : ''}
              key={c.id}
              onClick={() => set('category', c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="catalog-tools">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            set('q', query);
          }}
        >
          <input
            aria-label="Search products"
            placeholder="Find something good…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="icon-button" aria-label="Search">
            <ArrowRight size={16} />
          </button>
        </form>
        <label>
          Sort by{' '}
          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => set('sort', e.target.value)}
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="newest">Newest</option>
          </select>
          <ArrowDown size={12} />
        </label>
      </div>
      <div className="catalog-filters">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={search.get('availability') === 'in-stock'}
            onChange={(e) => set('availability', e.target.checked ? 'in-stock' : 'all')}
          />
          In stock only
        </label>
        <span className="muted">{meta?.total ?? 0} objects</span>
      </div>
      <Notice>{error}</Notice>
      {loading ? (
        <Loading />
      ) : data?.length ? (
        <div className="product-grid catalog-grid">
          {data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <Empty title="No objects found.">
          <p>Try another search or category.</p>
          <button
            onClick={() => {
              setQuery('');
              setSearch({});
            }}
          >
            Clear filters
          </button>
        </Empty>
      )}
      {meta && meta.pages > 1 && (
        <div className="pagination">
          <button
            disabled={meta.page <= 1}
            onClick={() => {
              const next = new URLSearchParams(search);
              next.set('page', String(meta.page - 1));
              setSearch(next);
            }}
          >
            Previous
          </button>
          <span>
            Page {meta.page} of {meta.pages}
          </span>
          <button
            disabled={meta.page >= meta.pages}
            onClick={() => {
              const next = new URLSearchParams(search);
              next.set('page', String(meta.page + 1));
              setSearch(next);
            }}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
export function ProductDetail() {
  const { slug } = useParams(),
    { market, add, money, config } = useStore(),
    {
      data: p,
      loading,
      error,
    } = useResource<Product>(`/products/${slug}?marketId=${encodeURIComponent(market)}`),
    [variantId, setVariantId] = useState(''),
    [quantity, setQuantity] = useState(1),
    action = useAction();
  if (loading) return <Loading />;
  if (!p) return <Notice>{error || 'Product not found.'}</Notice>;
  const v = p.variants.find((v) => v.id === variantId) ?? p.variants[0];
  return (
    <section className="product-detail">
      <div className="breadcrumbs">
        <Link to="/shop">All objects</Link>
        <span>/</span>
        <Link to={`/shop?category=${p.category.slug}`}>{p.category.name}</Link>
        <span>/</span>
        {p.name}
      </div>
      <div className="detail-grid">
        <div className="detail-art panel" style={{ background: p.background }}>
          <ProductArt {...p} />
          {p.badge && <span className="product-badge">{p.badge}</span>}
        </div>
        <div className="detail-copy">
          <span className="eyebrow">{p.category.name} · Thoughtfully made</span>
          <h1>{p.name}</h1>
          <p className="detail-price">{money(v.priceMinor)}</p>
          <p>{p.description}</p>
          <Field label="Finish">
            <select value={v.id} onChange={(e) => setVariantId(e.target.value)}>
              {p.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="add-row">
            <Field label="Quantity">
              <input
                aria-label="Quantity"
                type="number"
                min="1"
                max={Math.min(10, v.available)}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </Field>
            <button
              className="button"
              disabled={action.busy || v.available < quantity || quantity < 1}
              onClick={() => action.run(() => add(v.id, quantity))}
            >
              {v.available ? 'Add to bag' : 'Currently sold out'}
              <Plus size={17} />
            </button>
          </div>
          <Notice>{action.error}</Notice>
          <div className="detail-benefits">
            <span>
              <Truck size={17} />
              {config.home.deliveryPromise}
            </span>
            <span>
              <ShieldCheck size={17} />
              {config.returns.windowDays}-day returns
            </span>
          </div>
          {[
            ['Materials', p.materials],
            ['Dimensions', p.dimensions],
            ['Care', p.care],
          ].map(([t, b]) => (
            <details key={t}>
              <summary>
                {t}
                <Plus size={15} />
              </summary>
              <p>{b || 'Contact us for more information.'}</p>
            </details>
          ))}
        </div>
      </div>
      <section className="reviews-section">
        <h2>At home with {p.name}</h2>
        {p.reviews.length ? (
          p.reviews.map((r) => (
            <article className="review panel" key={r.id}>
              <span>
                {'★'.repeat(r.rating)}
                {'☆'.repeat(5 - r.rating)}
              </span>
              <p>{r.body}</p>
              <small>{r.user.name} · Verified purchase</small>
            </article>
          ))
        ) : (
          <p className="muted">
            A new favourite, waiting for its first story. Reviews are from verified delivered
            purchases.
          </p>
        )}
      </section>
    </section>
  );
}
