import { request, type Envelope } from './api.js';
const pending = new Map<string, Promise<Envelope<unknown>>>();
const cache = new Map<string, { expires: number; value: Envelope<unknown> }>();
const publicPath = (path: string) => /^\/(config|categories|products)(\?|\/|$)/.test(path);
export function resource<T>(path: string, fresh = false): Promise<Envelope<T>> {
  if (!publicPath(path) && path !== '/auth/me') return request<T>(path);
  const saved = cache.get(path);
  if (!fresh && saved && saved.expires > Date.now())
    return Promise.resolve(saved.value as Envelope<T>);
  const current = pending.get(path);
  if (current) return current as Promise<Envelope<T>>;
  const promise = request<T>(path)
    .then((value) => {
      if (publicPath(path)) {
        if (cache.size >= 50) cache.delete(cache.keys().next().value!);
        cache.set(path, { expires: Date.now() + 30_000, value });
      }
      return value;
    })
    .finally(() => {
      if (pending.get(path) === promise) pending.delete(path);
    });
  pending.set(path, promise);
  return promise;
}

if (typeof window !== 'undefined') {
  window.addEventListener('catalog-changed', () => cache.clear());
  window.addEventListener('session-changed', () => pending.delete('/auth/me'));
}
