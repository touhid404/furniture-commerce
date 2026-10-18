import { StrictMode, useEffect, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import type { publicStoreConfig } from '../../api/src/config';

type PublicConfig = ReturnType<typeof publicStoreConfig>;
type DatabaseState = { status: 'pending' | 'checking' | 'connected' | 'unavailable'; latencyMs?: number; checkedAt?: string };

function App() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [db, setDb] = useState<DatabaseState>({ status: 'pending' });
  const [request, setRequest] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/config', { signal: controller.signal }).then(async (res) => {
      if (!res.ok) throw new Error('Config unavailable');
      const body = await res.json(); setConfig(body.data);
    }).catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) setConfigError(true); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    fetch('/api/v1/health/ready', { signal: controller.signal, cache: 'no-store' }).then(async (res) => {
      if (!res.ok) throw new Error('Database unavailable');
      const body = await res.json(); setDb(body.data.database);
    }).catch(() => { if (!controller.signal.aborted) setDb({ status: 'unavailable' }); })
      .finally(() => clearTimeout(timer));
    const onAbort = () => setDb({ status: 'unavailable' });
    controller.signal.addEventListener('abort', onAbort);
    return () => { controller.signal.removeEventListener('abort', onAbort); clearTimeout(timer); controller.abort(); };
  }, [request]);

  if (!config) return <main className="boot" role="status">{configError ? 'Store configuration could not load. Check that the API is running.' : 'Loading store configuration…'}</main>;
  const copy = config.messages[config.defaultLocale as keyof typeof config.messages];
  const theme = Object.fromEntries(Object.entries(config.theme).map(([key, value]) => [`--${key}`, value])) as CSSProperties;
  const status = db.status === 'pending' ? copy.checking : copy[db.status];
  return <div className="shell" style={theme}>
    <header><span className="brand"><span aria-hidden="true" className="mark">K</span>{config.brand.name}</span><span className="stage">Development foundation</span></header>
    <main className="foundation">
      <section className="intro"><span className="eyebrow">{copy.setupTitle}</span><h1>{config.home.headline}</h1><p>{copy.setupDescription}</p><p className="note">{copy.readyNote}</p></section>
      <section className="status-card" aria-labelledby="db-title"><span className="eyebrow">React · Express · Prisma</span><h2 id="db-title">{copy.databaseLabel}</h2><p className={`connection ${db.status}`} role="status" aria-live="polite" data-testid="database-status"><span aria-hidden="true" />{status}</p>{db.latencyMs !== undefined && <p className="detail">{db.latencyMs} ms · {new Intl.DateTimeFormat(config.defaultLocale, { timeStyle: 'medium', timeZone: config.timezone }).format(new Date(db.checkedAt!))}</p>}{db.status === 'unavailable' && <p>{copy.errorNote}</p>}<button type="button" disabled={db.status === 'checking' || db.status === 'pending'} onClick={() => { setDb({ status: 'checking' }); setRequest((x) => x + 1); }}>{copy.checkAgain}</button><p className="detail">Read-only verification through the backend API</p></section>
    </main><footer>{config.brand.name} · {config.revision}</footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
