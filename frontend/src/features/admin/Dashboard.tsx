import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  ShoppingCart,
  Users,
  Receipt,
  ArrowRight,
} from 'lucide-react';
import { useStore } from '../../app/Store.js';
import { useResource } from '../../lib/hooks.js';
import type { Dashboard as DashboardData } from '../../lib/types.js';
import { Loading, Notice } from '../../components/UI.js';
const colors = ['#4a58b6', '#e4c85d', '#20241b', '#ce8065', '#6eaa8b'];
export function LineChart({ values, area = false }: { values: number[]; area?: boolean }) {
  const max = Math.max(...values, 1),
    w = 600,
    h = 180;
  const coords = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - 12 - (v / max) * (h - 30)}`)
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${w} ${h + 10}`}
      preserveAspectRatio="none"
      className={area ? 'area-chart' : 'sparkline'}
      role="img"
      aria-label={`Trend with ${values.length} observations; latest ${values.at(-1) ?? 0}`}
    >
      <defs>
        <linearGradient id={area ? 'chart-area' : 'spark-area'} x2="0" y2="1">
          <stop stopColor="#6875bf" stopOpacity=".24" />
          <stop offset="1" stopColor="#6875bf" stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <line
              key={i}
              x1="0"
              y1={i * 50 + 10}
              x2={w}
              y2={i * 50 + 10}
              stroke="#daddd2"
              strokeDasharray="3 5"
            />
          ))}
          <polygon points={`0,${h} ${coords} ${w},${h}`} fill="url(#chart-area)" />
        </>
      )}
      <polyline
        points={coords}
        fill="none"
        stroke="currentColor"
        strokeWidth={area ? 2 : 4}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Dashboard() {
  const { user, config, money, cart, locale } = useStore(),
    [range, setRange] = useState('30d'),
    [metric, setMetric] = useState<'orders' | 'revenue'>('orders'),
    {
      data: d,
      loading,
      error,
      reload,
    } = useResource<DashboardData>(`/admin/dashboard?range=${range}&currency=${cart.currency}`);
  useEffect(() => {
    const t = setInterval(
      reload,
      config.dashboard?.pollSeconds ? config.dashboard.pollSeconds * 1000 : 30000,
    );
    return () => clearInterval(t);
  }, [reload, config]);
  if (loading && !d) return <Loading />;
  if (!d) return <Notice>{error}</Notice>;
  const categoryTotal = Object.values(d.categories).reduce((a, b) => a + b, 0),
    entries = Object.entries(d.categories);
  let running = 0;
  const gradient = entries.length
    ? entries
        .map(([, v], i) => {
          const start = running;
          running += (v / Math.max(categoryTotal, 1)) * 100;
          return `${colors[i % colors.length]} ${start}% ${running}%`;
        })
        .join(',')
    : '#dedfd5 0% 100%';
  const metrics = [
    ['Revenue', 'revenue', Banknote],
    ['Orders', 'orders', ShoppingCart],
    ['Avg. order value', 'aov', Receipt],
    ['Customers', 'customers', Users],
  ] as const;
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <span className="muted">
            {new Intl.DateTimeFormat(locale, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              timeZone: config.timezone,
            }).format(new Date())}
          </span>
          <h1>
            Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.name.split(' ')[0]}
          </h1>
        </div>
        <div className="range-switch" aria-label="Dashboard period">
          {['7d', '30d', '90d'].map((r) => (
            <button className={range === r ? 'selected' : ''} onClick={() => setRange(r)} key={r}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <Notice>{error}</Notice>
      <div className="metric-grid">
        {metrics.map(([label, key, Icon]) => {
          const delta = d.comparison[key]
            ? Math.round(((d.metrics[key] - d.comparison[key]) / d.comparison[key]) * 100)
            : null;
          return (
            <article className="metric-card panel" key={key}>
              <div className="split">
                <span>{label}</span>
                <span className="metric-icon">
                  <Icon size={15} />
                </span>
              </div>
              <strong>
                {key === 'revenue' || key === 'aov'
                  ? money(d.metrics[key])
                  : d.metrics[key].toLocaleString()}
              </strong>
              <div className="metric-footer">
                <span className={`delta ${delta !== null && delta < 0 ? 'negative' : ''}`}>
                  {delta === null ? (
                    'No prior data'
                  ) : (
                    <>
                      {delta < 0 ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}{' '}
                      {delta > 0 ? '+' : ''}
                      {delta}%
                    </>
                  )}
                </span>
                <LineChart values={d.series.map((s) => s[key])} />
              </div>
            </article>
          );
        })}
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-left">
          <section className="panel chart-panel">
            <div className="split">
              <div>
                <h3>
                  {metric === 'orders' ? 'Orders' : 'Revenue'} · last {range.slice(0, -1)} days
                </h3>
                <small>{d.metrics.orders} orders in total</small>
              </div>
              <div className="segment-switch">
                {(['revenue', 'orders'] as const).map((m) => (
                  <button
                    className={metric === m ? 'selected' : ''}
                    key={m}
                    onClick={() => setMetric(m)}
                  >
                    {m[0].toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="chart-wrap">
              <div className="chart-scale">
                <span>{Math.max(...d.series.map((s) => s[metric]), 0)}</span>
                <span>0</span>
              </div>
              <LineChart values={d.series.map((s) => s[metric])} area />
            </div>
            <div className="chart-labels">
              <span>
                {new Date(d.series[0].date).toLocaleDateString(locale, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span>Today</span>
            </div>
          </section>
          <div className="dashboard-lower">
            <section className="panel today-panel">
              <h3>Today</h3>
              <small>Goal {money(d.goalMinor)}</small>
              <div className="today-content">
                <div
                  className="donut goal-donut"
                  style={{
                    background: `conic-gradient(#20241b ${Math.min(100, (d.today.revenue / Math.max(1, d.goalMinor)) * 100)}%,#e8e9df 0)`,
                  }}
                >
                  <div>
                    <strong>{money(d.today.revenue)}</strong>
                    <small>
                      {Math.round((d.today.revenue / Math.max(1, d.goalMinor)) * 100)}% of goal
                    </small>
                  </div>
                </div>
                <div>
                  <strong className="today-number">{d.today.orders}</strong>
                  <small>orders so far</small>
                  <Link to="/admin/orders" className="text-link">
                    View orders <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </section>
            <section className="panel category-panel">
              <h3>Sales by category</h3>
              <small>Share of net collected product revenue</small>
              <div className="category-breakdown">
                <div className="donut" style={{ background: `conic-gradient(${gradient})` }}>
                  <div>
                    <strong>{money(categoryTotal)}</strong>
                    <small>All</small>
                  </div>
                </div>
                <ul>
                  {entries.length ? (
                    entries.map(([k, v], i) => (
                      <li key={k}>
                        <i style={{ background: colors[i % colors.length] }} />
                        {k}
                        <b>{Math.round((v / Math.max(1, categoryTotal)) * 100)}%</b>
                      </li>
                    ))
                  ) : (
                    <li>No collected sales yet</li>
                  )}
                </ul>
              </div>
            </section>
          </div>
        </div>
        <section className="panel recent-panel">
          <div className="split">
            <h3>Recent orders</h3>
            <span className="live-label">
              <i className="live-dot" />
              Updated
            </span>
          </div>
          <small>{config.demo ? 'Includes fictional demo orders' : 'Latest customer orders'}</small>
          <div className="recent-list">
            {d.recent.map((o) => (
              <Link key={o.id} to={`/admin/orders/${o.id}`} className="recent-order">
                <span className="avatar">
                  {(o.address?.recipient ?? o.email).slice(0, 2).toUpperCase()}
                </span>
                <span>
                  <strong>{o.address?.recipient ?? o.email}</strong>
                  <small>
                    {o.address?.city} · {o.items.reduce((s, i) => s + i.quantity, 0)} items
                  </small>
                </span>
                <span>
                  <strong>{money(o.totalMinor, o.currency)}</strong>
                  <small>
                    {new Date(o.createdAt).toLocaleDateString(locale, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </small>
                </span>
              </Link>
            ))}
          </div>
          <Link className="text-link" to="/admin/orders">
            All orders <ArrowUpRight size={13} />
          </Link>
        </section>
      </div>
    </>
  );
}
