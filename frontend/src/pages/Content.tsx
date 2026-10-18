import { Link, useParams } from 'react-router-dom';
import { useStore } from '../app/Store.js';
import { useResource } from '../lib/hooks.js';
import type { Content } from '../lib/types.js';
import { Empty, Loading, Notice } from '../components/UI.js';
export function Policy() {
  const { key } = useParams(),
    { data, loading, error } = useResource<Content>(`/content/${key}`);
  if (loading) return <Loading />;
  return (
    <section className="narrow-page panel">
      <span className="eyebrow">The little details</span>
      <h1>{data?.title ?? 'Page unavailable'}</h1>
      <Notice>{error}</Notice>
      <div className="prose">{data?.body}</div>
      <Link to="/contact" className="text-link">
        A question? We’re here to help ↗
      </Link>
    </section>
  );
}
export function Contact() {
  const { config } = useStore();
  return (
    <section className="narrow-page panel">
      <span className="eyebrow">A little conversation</span>
      <h1>Let’s talk.</h1>
      <p>
        Questions about an object, your order, or making your space feel more like you? We’d love to
        help.
      </p>
      <a className="button" href={`mailto:${config.brand.supportEmail}`}>
        {config.brand.supportEmail} ↗
      </a>
      <p className="muted">For an existing purchase, include your order number.</p>
      <Link className="text-link" to="/order-access">
        Find your order
      </Link>
    </section>
  );
}
export function NotFound() {
  return (
    <Empty title="A little off the beaten path.">
      <p>We couldn’t find that page.</p>
      <Link className="button" to="/">
        Come back home ↗
      </Link>
    </Empty>
  );
}
