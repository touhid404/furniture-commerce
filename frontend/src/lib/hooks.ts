import { useCallback, useEffect, useState, useRef } from 'react';
import { request, type Envelope } from './api.js';
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  const [meta, setMeta] = useState<Envelope<T>['meta']>();
  const priorPath = useRef(path);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    if (priorPath.current !== path) {
      setData(null);
      setMeta(undefined);
    }
    priorPath.current = path;
    request<T>(path, { signal: controller.signal })
      .then((body) => {
        if (!controller.signal.aborted) {
          setData(body.data);
          setMeta(body.meta);
        }
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, version]);
  return { data, setData, meta, error, loading, reload };
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run, setError };
}
export const formValues = (form: HTMLFormElement) =>
  Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
