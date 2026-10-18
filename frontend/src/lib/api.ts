import { ActionCancelled, adminConfirmation, confirmAction } from './confirmation.js';
import { ApiError, decodeApiResponse } from './http.js';
export { ApiError } from './http.js';
let administrator = false;
let csrfToken: string | null = null;
let bootstrap: Promise<void> | null = null;
export interface Envelope<T> {
  data: T;
  meta?: { total: number; page: number; pages: number };
}
export async function request<T>(path: string, init: RequestInit = {}): Promise<Envelope<T>> {
  const method = (init.method ?? 'GET').toUpperCase();
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(method) &&
    (path.startsWith('/admin/') || (administrator && path === '/auth/logout'))
  ) {
    if (!(await confirmAction(adminConfirmation(path, method)))) throw new ActionCancelled();
  }
  if (!['GET', 'HEAD'].includes(method) && !csrfToken) await initializeCsrf();
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string' && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  if (csrfToken && !['GET', 'HEAD'].includes(method)) headers.set('X-CSRF-Token', csrfToken);
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  let body: Envelope<T> & { data: T & { user?: { role: string }; csrfToken?: string } };
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch('/api/v1' + path, {
        ...init,
        headers,
        credentials: 'same-origin',
      });
      body = await decodeApiResponse<typeof body>(response, mutation);
      break;
    } catch (error) {
      const failure =
        error instanceof ApiError
          ? error
          : new ApiError(
              mutation
                ? 'The change could not be confirmed. Refresh to check its status before trying again.'
                : 'We could not reach the store. Check your connection and try again.',
              'NETWORK_ERROR',
              0,
            );
      if (!mutation && attempt === 0 && [0, 502, 503, 504].includes(failure.status)) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      throw failure;
    }
  }
  if (body.data && Object.hasOwn(body.data, 'user'))
    administrator = body.data.user?.role === 'ADMIN';
  if (path === '/auth/logout') administrator = false;
  if (body.data?.csrfToken) csrfToken = body.data.csrfToken;
  if (typeof window !== 'undefined' && !['GET', 'HEAD'].includes(method)) {
    if (path.startsWith('/admin/')) window.dispatchEvent(new Event('catalog-changed'));
    if (/^\/auth\/(login|logout|register|demo)$/.test(path))
      window.dispatchEvent(new Event('session-changed'));
  }
  return body;
}
export const api = async <T>(path: string, init?: RequestInit) =>
  (await request<T>(path, init)).data;
export const send = <T>(path: string, data: unknown = {}, method = 'POST', headers?: HeadersInit) =>
  api<T>(path, { method, body: JSON.stringify(data), headers });
export function initializeCsrf() {
  if (!bootstrap)
    bootstrap = api<{ csrfToken: string }>('/auth/csrf')
      .then(() => {})
      .catch((e) => {
        bootstrap = null;
        throw e;
      });
  return bootstrap;
}
export function clearSession() {
  csrfToken = null;
  bootstrap = null;
}
