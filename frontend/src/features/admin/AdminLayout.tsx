import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import {
  Box,
  ClipboardList,
  ExternalLink,
  FileText,
  Image,
  LayoutGrid,
  MessageSquare,
  Package,
  RotateCcw,
  Settings,
  ShieldCheck,
  Tag,
  Ticket,
  Bell,
  LogOut,
} from 'lucide-react';
import { useStore } from '../../app/Store.js';
import { Logo } from '../../components/StoreLayout.js';
import { useAction } from '../../lib/hooks.js';
import { Notice } from '../../components/UI.js';
const links = [
  ['', 'Overview', LayoutGrid],
  ['orders', 'Orders', ClipboardList],
  ['products', 'Products', Box],
  ['categories', 'Categories', Tag],
  ['content', 'Storefront', FileText],
  ['inventory', 'Inventory', Package],
  ['returns', 'Returns', RotateCcw],
  ['reviews', 'Reviews', MessageSquare],
  ['coupons', 'Promotions', Ticket],
  ['media', 'Media', Image],
  ['notifications', 'Notifications', Bell],
  ['audit', 'Audit trail', ShieldCheck],
  ['settings', 'Settings', Settings],
] as const;
export default function AdminLayout() {
  const { user, config, logout } = useStore(),
    action = useAction();
  if (!user) return <Navigate to="/sign-in?next=/admin" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/account" replace />;
  if (!config.demo && !user.mfaEnabled) return <Navigate to="/account/security" replace />;
  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-main">
        Skip to content
      </a>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Logo />
          {config.demo && <span className="demo-label">Demo</span>}
        </div>
        <nav aria-label="Admin navigation">
          {links.map(([path, label, Icon]) => (
            <NavLink key={path} end={path === ''} to={`/admin${path ? '/' + path : ''}`}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link to="/" className="store-link">
            <ExternalLink size={14} />
            View storefront
          </Link>
          <div className="demo-info">
            <span className="live-dot" />
            {config.demo ? 'Demo environment' : 'Store operations'}
            <small>
              {config.demo ? 'Fictional seed data · real database' : 'Authenticated administrator'}
            </small>
          </div>
          <div className="admin-profile">
            <span>{user.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              disabled={action.busy}
              onClick={() => action.run(logout)}
            >
              <LogOut size={15} />
            </button>
          </div>
          <Notice>{action.error}</Notice>
        </div>
      </aside>
      <main id="admin-main" className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
