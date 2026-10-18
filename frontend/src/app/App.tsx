import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { StoreProvider, useStore } from './Store.js';
import { StoreLayout, Toast } from '../components/StoreLayout.js';
import { Loading } from '../components/UI.js';
import { Home, ProductDetail, Shop } from '../pages/Catalog.js';
import { Bag, Checkout } from '../pages/Checkout.js';
import { SignIn, AccessPage } from '../pages/Auth.js';
import { Account, OrderDetail, Security } from '../pages/Account.js';
import { Policy, Contact, NotFound } from '../pages/Content.js';
const AdminLayout = lazy(() => import('../features/admin/AdminLayout.js'));
const Dashboard = lazy(() =>
  import('../features/admin/Dashboard.js').then((m) => ({ default: m.Dashboard })),
);
const Orders = lazy(() =>
  import('../features/admin/Orders.js').then((m) => ({ default: m.Orders })),
);
const AdminOrder = lazy(() =>
  import('../features/admin/Orders.js').then((m) => ({ default: m.AdminOrder })),
);
const Products = lazy(() =>
  import('../features/admin/Products.js').then((m) => ({ default: m.Products })),
);
const ProductEditor = lazy(() =>
  import('../features/admin/Products.js').then((m) => ({ default: m.ProductEditor })),
);
const Categories = lazy(() =>
  import('../features/admin/Products.js').then((m) => ({ default: m.Categories })),
);
const Inventory = lazy(() =>
  import('../features/admin/Operations.js').then((m) => ({ default: m.InventoryPage })),
);
const Returns = lazy(() =>
  import('../features/admin/Operations.js').then((m) => ({ default: m.ReturnsPage })),
);
const Reviews = lazy(() =>
  import('../features/admin/Operations.js').then((m) => ({ default: m.ReviewsPage })),
);
const Content = lazy(() =>
  import('../features/admin/Operations.js').then((m) => ({ default: m.ContentPage })),
);
const Coupons = lazy(() =>
  import('../features/admin/Operations.js').then((m) => ({ default: m.CouponsPage })),
);
const Media = lazy(() =>
  import('../features/admin/Operations.js').then((m) => ({ default: m.MediaPage })),
);
const Audit = lazy(() =>
  import('../features/admin/Operations.js').then((m) => ({ default: m.AuditPage })),
);
const Notifications = lazy(() =>
  import('../features/admin/Operations.js').then((m) => ({ default: m.NotificationsPage })),
);
const Settings = lazy(() =>
  import('../features/admin/Operations.js').then((m) => ({ default: m.SettingsPage })),
);
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="boot">
        <h1>Something needs a little attention.</h1>
        <p>The page could not be opened.</p>
        <button onClick={() => location.reload()}>Reload the store</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Metadata() {
  const { config } = useStore(),
    location = useLocation();
  useEffect(() => {
    document.title = `${location.pathname.startsWith('/admin') ? 'Store admin · ' : ''}${config.brand.name} — ${config.brand.tagline}`;
    document.documentElement.lang = config.defaultLocale;
  }, [config, location.pathname]);
  return null;
}
export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <StoreProvider>
          <Metadata />
          <Toast />
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route element={<StoreLayout />}>
                <Route index element={<Home />} />
                <Route path="shop" element={<Shop />} />
                <Route path="products/:slug" element={<ProductDetail />} />
                <Route path="bag" element={<Bag />} />
                <Route path="checkout" element={<Checkout />} />
                <Route path="sign-in" element={<SignIn />} />
                <Route path="account" element={<Account />} />
                <Route path="account/security" element={<Security />} />
                <Route path="orders/:id" element={<OrderDetail />} />
                {['forgot-password', 'reset-password', 'verify-email', 'order-access'].map((p) => (
                  <Route key={p} path={p} element={<AccessPage />} />
                ))}
                <Route path="policies/:key" element={<Policy />} />
                <Route path="contact" element={<Contact />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="orders" element={<Orders />} />
                <Route path="orders/:id" element={<AdminOrder />} />
                <Route path="products" element={<Products />} />
                <Route path="products/:id" element={<ProductEditor />} />
                <Route path="categories" element={<Categories />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="returns" element={<Returns />} />
                <Route path="reviews" element={<Reviews />} />
                <Route path="content" element={<Content />} />
                <Route path="coupons" element={<Coupons />} />
                <Route path="media" element={<Media />} />
                <Route path="audit" element={<Audit />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </StoreProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
