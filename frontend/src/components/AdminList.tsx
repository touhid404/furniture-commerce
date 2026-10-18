import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useResource } from '../lib/hooks.js';
import type { Envelope } from '../lib/api.js';
export function useAdminList<T>(path: string) {
  const [params, setParams] = useSearchParams(),
    search = params.get('q') ?? '',
    page = Math.max(1, Number(params.get('page')) || 1),
    limit = [12, 24, 48, 100].includes(Number(params.get('limit')))
      ? Number(params.get('limit'))
      : 12;
  const [draft, setDraft] = useState(search);
  const query = new URLSearchParams(params);
  query.set('page', String(page));
  query.set('limit', String(limit));
  const result = useResource<T[]>(`${path}?${query}`);
  const setPage = (value: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(Math.max(1, value)));
    setParams(next);
  };
  useEffect(() => setDraft(search), [search]);
  useEffect(() => {
    if (draft === search) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (draft.trim()) next.set('q', draft.trim());
      else next.delete('q');
      next.delete('page');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, search, params, setParams]);
  useEffect(() => {
    if (!result.loading && result.meta && page > Math.max(1, result.meta.pages))
      setPage(Math.max(1, result.meta.pages));
  }, [result.loading, result.meta, page]);
  return {
    ...result,
    page,
    limit,
    search: draft,
    setSearch: setDraft,
    setPage,
    setLimit: (value: number) => {
      const next = new URLSearchParams(params);
      next.set('limit', String(value));
      next.delete('page');
      setParams(next);
    },
  };
}
interface Controls {
  meta?: Envelope<unknown>['meta'];
  page: number;
  limit: number;
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  setPage: (value: number) => void;
  setLimit: (value: number) => void;
}
export function AdminListTools({ list, label }: { list: Controls; label: string }) {
  return (
    <div className="admin-toolbar">
      <input
        aria-label={`Search ${label.toLowerCase()}`}
        placeholder={`Search ${label.toLowerCase()}…`}
        maxLength={100}
        value={list.search}
        onChange={(event) => list.setSearch(event.target.value)}
      />
      <span className="muted">{list.meta?.total ?? 0} records</span>
    </div>
  );
}
export function AdminPagination({ list }: { list: Controls }) {
  const pages = Math.max(1, list.meta?.pages ?? 1),
    total = list.meta?.total ?? 0;
  return (
    <nav className="pagination admin-pagination" aria-label="List pagination">
      <label>
        Rows per page{' '}
        <select
          aria-label="Rows per page"
          value={list.limit}
          onChange={(event) => list.setLimit(Number(event.target.value))}
        >
          {[12, 24, 48, 100].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <span>
        {total
          ? `${(list.page - 1) * list.limit + 1}–${Math.min(list.page * list.limit, total)} of ${total}`
          : '0 records'}
      </span>
      <button disabled={list.loading || list.page <= 1} onClick={() => list.setPage(list.page - 1)}>
        Previous
      </button>
      <span>
        Page {list.page} of {pages}
      </span>
      <button
        disabled={list.loading || list.page >= pages}
        onClick={() => list.setPage(list.page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
