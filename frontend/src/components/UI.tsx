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
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="loader" />
      Finding the good things…
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
