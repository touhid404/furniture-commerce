import { useEffect, useRef, useState } from 'react';
import { flyToCart } from '../lib/fly-to-cart.js';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Banknote,
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
    image = useRef<HTMLElement>(null),
    v = p.variants[0],
    navigate = useNavigate();
  return (
    <article className="product-card" ref={image}>
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
            p.variants.length > 1
              ? navigate(`/products/${p.slug}`)
              : action.run(async () => {
                  await add(p, v.id);
                  flyToCart(image.current?.querySelector('.product-art') ?? null);
                })
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
  const { config, categories, market, money, add } = useStore(),
    { data, meta, loading, error } = useResource<Product[]>(
      `/products?marketId=${encodeURIComponent(market)}`,
    ),
    action = useAction();
  if (loading && !data) return <Loading variant="home" />;
  if (error) return <Notice>{error}</Notice>;
  const featured =
    data?.find((p) => p.variants.some((v) => v.sku === config.home.featuredSku)) ?? data?.[0];
  return (
    <>
      <section className="home-bento">
        <div className="hero-copy panel">
          <span className="eyebrow">
            <i className="season-dot" />
            {config.home.eyebrow} · {meta?.total ?? data?.length} pieces just landed
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
          <span className="eyebrow">Delivery</span>
          <Truck size={28} strokeWidth={1} />
          <h2>
            Free over{' '}
            {money(config.delivery.find((r) => r.marketId === market)?.freeOverMinor ?? 0)}
          </h2>
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
              <ProductArt {...featured} priority />
            </Link>
            <div className="hero-product-bottom">
              <strong>{money(featured.variants[0].priceMinor)}</strong>
              <Link to={`/products/${featured.slug}`}>Details</Link>
              <button
                className="button"
                disabled={action.busy}
                onClick={(e) => {
                  const image =
                    e.currentTarget.closest('.hero-product')?.querySelector('.product-art') ?? null;
                  action.run(async () => {
                    await add(featured);
                    flyToCart(image);
                  });
                }}
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
      <section className="category-discovery" aria-labelledby="category-discovery-title">
        <div className="section-title">
          <div>
            <span className="eyebrow">A place for every good thing</span>
            <h2 id="category-discovery-title">Find your kind of comfort.</h2>
          </div>
          <p className="muted">Start with a corner. Make it your own.</p>
        </div>
        <div className="discovery-grid">
          {categories.slice(0, 4).map((category, index) => {
            const product = data?.find((p) => p.category.id === category.id);
            return (
              <Link
                className="discovery-card panel"
                key={category.id}
                to={`/shop?category=${encodeURIComponent(category.slug)}`}
              >
                <div className={`discovery-art discovery-tone-${index}`}>
                  {product ? (
                    <ProductArt {...product} />
                  ) : (
                    <ProductArt art="chair" name={category.name} />
                  )}
                  <span className="discovery-number">0{index + 1}</span>
                </div>
                <div className="discovery-caption">
                  <div>
                    <small>Explore the collection</small>
                    <h3>{category.name}</h3>
                  </div>
                  <ArrowUpRight size={20} strokeWidth={1.5} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="shopping-notes panel" aria-labelledby="shopping-notes-title">
        <div className="shopping-notes-copy">
          <span className="eyebrow">The little details, considered.</span>
          <h2 id="shopping-notes-title">
            Good things.
            <br />A little less guesswork.
          </h2>
          <p>From your first favourite to the moment it arrives, here’s what to expect.</p>
          <Link className="text-link" to="/contact">
            We’re here to help <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="shopping-notes-list">
          <Link to="/policies/shipping">
            <span className="shopping-note-icon">
              <Truck size={22} strokeWidth={1.5} />
            </span>
            <div>
              <h3>On its way to your everyday</h3>
              <p>{config.home.deliveryPromise}</p>
            </div>
            <ArrowUpRight size={16} />
          </Link>
          <Link to="/policies/returns">
            <span className="shopping-note-icon">
              <ShieldCheck size={22} strokeWidth={1.5} />
            </span>
            <div>
              <h3>A little time to feel at home</h3>
              <p>{config.returns.windowDays}-day returns. Read the details before you decide.</p>
            </div>
            <ArrowUpRight size={16} />
          </Link>
          <Link to="/policies/terms">
            <span className="shopping-note-icon">
              <Banknote size={22} strokeWidth={1.5} />
            </span>
            <div>
              <h3>Pay when it arrives</h3>
              <p>Cash on delivery. {config.checkout.onlinePaymentLabel}.</p>
            </div>
            <ArrowUpRight size={16} />
          </Link>
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
  useEffect(() => {
    setQuery(search.get('q') ?? '');
  }, [search]);
  useEffect(() => {
    if (query === (search.get('q') ?? '')) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(search);
      if (query.trim()) next.set('q', query.trim());
      else next.delete('q');
      next.delete('page');
      setSearch(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search, setSearch]);
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
      {loading && !data ? (
        <Loading variant="products" />
      ) : data?.length ? (
        <div className="product-grid catalog-grid" aria-busy={loading}>
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
            disabled={loading || meta.page <= 1}
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
            disabled={loading || meta.page >= meta.pages}
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
  if (loading) return <Loading variant="detail" />;
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
                max={Math.min(config.checkout.maxQuantityPerSku, v.available)}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </Field>
            <button
              className="button"
              disabled={action.busy || v.available < quantity || quantity < 1}
              onClick={(e) => {
                const image =
                  e.currentTarget.closest('.detail-grid')?.querySelector('.product-art') ?? null;
                action.run(async () => {
                  await add(p, v.id, quantity);
                  flyToCart(image);
                });
              }}
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
          <dl className="product-specifications">
            {[
              ['Materials', p.materials],
              ['Dimensions', p.dimensions],
              ['Care', p.care],
            ].map(([title, description]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{description || 'Contact us for more information.'}</dd>
              </div>
            ))}
          </dl>
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
