import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
export function Notice({
  children,
  kind = 'error',
}: {
  children?: ReactNode;
  kind?: 'error' | 'success' | 'info';
}) {
  return children ? (
    <p className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  ) : null;
}
export function Loading({
  variant = 'page',
  count = 6,
}: {
  variant?: 'page' | 'store' | 'home' | 'products' | 'detail' | 'table' | 'form' | 'dashboard';
  count?: number;
}) {
  const line = (className = '') => <span className={`skeleton-block skeleton-line ${className}`} />;
  const products = (
    <div className="product-grid catalog-grid">
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton-block skeleton-image" />
          {line()}
          {line('short')}
        </div>
      ))}
    </div>
  );
  const home = (
    <div className="home-bento skeleton-home">
      <div className="hero-copy panel">
        {line('short')}
        {line('heading')}
        {line('heading')}
        {line()}
      </div>
      <div className="skeleton-block soft-light" />
      <div className="skeleton-block delivery-card" />
      <div className="skeleton-block hero-product" />
    </div>
  );
  return (
    <div
      className={`skeleton-loading skeleton-${variant}`}
      role="status"
      aria-label="Loading content"
      aria-busy="true"
    >
      <span className="sr-only">Loading content…</span>
      <div aria-hidden="true">
        {variant === 'store' ? (
          <div className="store-shell">
            <div className="skeleton-block skeleton-header" />
            {home}
          </div>
        ) : variant === 'home' ? (
          home
        ) : variant === 'products' ? (
          products
        ) : variant === 'detail' ? (
          <div className="detail-grid">
            <div className="skeleton-block skeleton-detail-image" />
            <div className="skeleton-copy">
              {line('short')}
              {line('heading')}
              {line()}
              {line()}
              {line()}
              <div className="skeleton-block skeleton-control" />
              <div className="skeleton-block skeleton-control" />
            </div>
          </div>
        ) : variant === 'dashboard' ? (
          <>
            <div className="metric-grid">
              {Array.from({ length: 4 }, (_, i) => (
                <div className="panel skeleton-copy" key={i}>
                  {line('short')}
                  {line('heading')}
                  {line()}
                </div>
              ))}
            </div>
            <div className="skeleton-block skeleton-chart" />
          </>
        ) : variant === 'table' ? (
          <div className="panel skeleton-table">
            {Array.from({ length: count }, (_, i) => (
              <div className="skeleton-table-row" key={i}>
                {line()}
                {line()}
                {line('short')}
              </div>
            ))}
          </div>
        ) : (
          <div className="panel skeleton-copy">
            {line('heading')}
            {line()}
            {line()}
            {line('short')}
            {variant === 'form' && (
              <>
                <div className="skeleton-block skeleton-control" />
                <div className="skeleton-block skeleton-control" />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title = 'Nothing here just yet.',
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span aria-hidden="true">✳</span>
      <h2>{title}</h2>
      {children ?? (
        <Link className="button" to="/shop">
          Explore the collection ↗
        </Link>
      )}
    </div>
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Badge({ children }: { children?: ReactNode }) {
  return (
    <span className={`badge ${String(children).toLowerCase()}`}>
      {String(children ?? '').replaceAll('_', ' ')}
    </span>
  );
}
export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
