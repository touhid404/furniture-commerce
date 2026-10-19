const intervalMs = 14 * 60 * 1000;

export function startKeepalive(): () => void {
  if (process.env.KEEPALIVE_ENABLED !== 'true') return () => undefined;

  const origin = new URL(process.env.PUBLIC_APP_URL ?? '');
  if (origin.protocol !== 'https:')
    throw new Error('KEEPALIVE_ENABLED requires an HTTPS PUBLIC_APP_URL');
  const url = new URL('/api/v1/health/live', origin);

  const timer = setInterval(() => {
    void fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'error' })
      .then((response) => {
        if (!response.ok) console.warn(`Keepalive health check returned ${response.status}`);
      })
      .catch(() => console.warn('Keepalive health check failed'));
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
