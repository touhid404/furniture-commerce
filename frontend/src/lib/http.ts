export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}
// Proxies and restarting servers can return empty/text responses. Never expose JSON parser errors.
export async function decodeApiResponse<T>(response: Response, mutation = false): Promise<T> {
  if (response.status === 204 && response.ok) return { data: null } as T;
  const raw = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    /* A structured error follows below. */
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ApiError(
      mutation
        ? 'The change could not be confirmed. Refresh to check its status before trying again.'
        : 'The store service is temporarily unavailable. Please try again.',
      'INVALID_RESPONSE',
      response.ok ? 502 : response.status,
    );
  const parsed = body as { data?: unknown; error?: { message?: unknown; code?: unknown } };
  if (!response.ok)
    throw new ApiError(
      typeof parsed.error?.message === 'string'
        ? parsed.error.message
        : 'The request failed. Please try again.',
      typeof parsed.error?.code === 'string' ? parsed.error.code : 'REQUEST_FAILED',
      response.status,
    );
  if (!Object.hasOwn(parsed, 'data'))
    throw new ApiError(
      'The server returned an incomplete response. Refresh and try again.',
      'INVALID_RESPONSE',
      502,
    );
  return parsed as T;
}
