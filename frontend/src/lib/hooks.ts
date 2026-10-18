import { ActionCancelled } from './confirmation.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Envelope } from './api.js';
import { resource } from './resource-cache.js';
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  const [meta, setMeta] = useState<Envelope<T>['meta']>();
  const priorPath = useRef(path);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let active = true;
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    if (priorPath.current !== path && path.split('?')[0] !== priorPath.current?.split('?')[0]) {
      setData(null);
      setMeta(undefined);
    }
    priorPath.current = path;
    // Shared in-flight requests survive StrictMode cleanup; only the current subscriber may update UI.
    resource<T>(path, version > 0)
      .then((body) => {
        if (active) {
          setData(body.data);
          setMeta(body.meta);
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
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
      if (!(e instanceof ActionCancelled))
        setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run, setError };
}
export const formValues = (form: HTMLFormElement) =>
  Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
