export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}
let csrfToken: string | null = null;
let bootstrap: Promise<void> | null = null;
export interface Envelope<T> {
  data: T;
  meta?: { total: number; page: number; pages: number };
}
export async function request<T>(path: string, init: RequestInit = {}): Promise<Envelope<T>> {
  const method = init.method ?? 'GET';
  if (!['GET', 'HEAD'].includes(method) && !csrfToken) await initializeCsrf();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (csrfToken && !['GET', 'HEAD'].includes(method)) headers.set('X-CSRF-Token', csrfToken);
  const response = await fetch('/api/v1' + path, {
    ...init,
    headers,
    credentials: 'same-origin',
  });
  const body = await response.json();
  if (!response.ok)
    throw new ApiError(
      body.error?.message ?? 'The request failed. Please try again.',
      body.error?.code ?? 'REQUEST_FAILED',
      response.status,
    );
  if (body.data?.csrfToken) csrfToken = body.data.csrfToken;
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
