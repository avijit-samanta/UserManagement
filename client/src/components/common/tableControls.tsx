import { useEffect, useState } from 'react';
import { Button } from './Button';

// Shared by the admin/user data tables (TicketList, UserList): sortable
// column headers and a fixed-size pager, both purely client-side over the
// list the page already fetched.

export const TABLE_PAGE_SIZE = 20;

export type SortDir = 'asc' | 'desc';
export type SortState<K extends string> = { key: K; dir: SortDir } | null;

export function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

// null = the order the list arrived in, until a header is clicked. First
// click on a column sorts ascending, the next one flips it.
export function useSort<K extends string>() {
  const [sort, setSort] = useState<SortState<K>>(null);
  const toggle = (key: K) =>
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  return [sort, toggle] as const;
}

// `resetKey` should change whenever the filters or sort change, so the view
// starts back on page 1 instead of an out-of-range page.
export function usePagination<T>(items: T[], resetKey: string) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / TABLE_PAGE_SIZE));

  useEffect(() => setPage(1), [resetKey]);
  // A delete that empties the last page steps back one.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pageStart = (Math.min(page, pageCount) - 1) * TABLE_PAGE_SIZE;
  return {
    page: Math.min(page, pageCount),
    setPage,
    pageCount,
    pageStart,
    pageRows: items.slice(pageStart, pageStart + TABLE_PAGE_SIZE),
    total: items.length,
  };
}

export function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onToggle,
  testIdPrefix,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onToggle: (key: K) => void;
  testIdPrefix: string;
}) {
  const active = sort?.key === sortKey;
  const dir = active ? sort!.dir : null;
  return (
    <th aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
      <button
        type="button"
        className="sort-button"
        onClick={() => onToggle(sortKey)}
        data-testid={`${testIdPrefix}-sort-${sortKey}`}
      >
        {label}
        <span className="sort-indicator" aria-hidden="true">
          {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕'}
        </span>
      </button>
    </th>
  );
}

export function Pagination({
  page,
  pageCount,
  pageStart,
  shown,
  total,
  onPageChange,
  testIdPrefix,
}: {
  page: number;
  pageCount: number;
  pageStart: number;
  shown: number;
  total: number;
  onPageChange: (page: number) => void;
  testIdPrefix: string;
}) {
  return (
    <div className="pagination" data-testid={`${testIdPrefix}-pagination`}>
      <span className="pagination-summary" data-testid={`${testIdPrefix}-pagination-summary`}>
        Showing {pageStart + 1}–{pageStart + shown} of {total}
      </span>
      <div className="pagination-controls">
        <Button
          type="button"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          data-testid={`${testIdPrefix}-page-prev`}
        >
          Previous
        </Button>
        <span data-testid={`${testIdPrefix}-page-indicator`}>
          Page {page} of {pageCount}
        </span>
        <Button
          type="button"
          variant="secondary"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          data-testid={`${testIdPrefix}-page-next`}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
