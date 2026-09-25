import { useMemo, useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { Button } from '../common/Button';
import { Pagination, SortHeader, compareText, usePagination, useSort } from '../common/tableControls';
import type { Ticket, TicketStatus } from '../../types';

type SortKey = 'id' | 'title' | 'submittedByName' | 'status' | 'updatedAt';

// Workflow order rather than alphabetical, so "ascending" reads as
// "needs attention first".
const STATUS_ORDER: Record<TicketStatus, number> = { open: 0, answered: 1, closed: 2 };

function compareTickets(a: Ticket, b: Ticket, key: SortKey): number {
  switch (key) {
    case 'status':
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    case 'updatedAt':
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    default:
      return compareText(a[key], b[key]);
  }
}

// <input type="date"> values are local calendar days (YYYY-MM-DD), so the
// ticket timestamp is converted to the same local day before comparing —
// comparing against the raw UTC ISO string would shift tickets across
// midnight for anyone not on UTC.
function localDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function TicketList({
  tickets,
  onSelect,
  selectedId,
  showSubmitter = false,
  onDelete,
}: {
  tickets: Ticket[];
  onSelect: (ticket: Ticket) => void;
  selectedId?: string;
  showSubmitter?: boolean;
  onDelete?: (ticket: Ticket) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TicketStatus | 'all'>('all');
  // A submitter's user id ('all' = everyone); only offered with showSubmitter.
  const [submitter, setSubmitter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, toggleSort] = useSort<SortKey>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keyed by id, labelled by name — two users can share a display name.
  const submitters = useMemo(() => {
    const byId = new Map<string, string>();
    for (const ticket of tickets) byId.set(ticket.submittedBy, ticket.submittedByName);
    return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => compareText(a.name, b.name));
  }, [tickets]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = tickets.filter((ticket) => {
      if (status !== 'all' && ticket.status !== status) return false;
      if (submitter !== 'all' && ticket.submittedBy !== submitter) return false;
      if (query && !ticket.id.toLowerCase().includes(query) && !ticket.title.toLowerCase().includes(query)) {
        return false;
      }
      const day = localDay(ticket.updatedAt);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      return true;
    });
    if (sort) {
      result.sort((a, b) => compareTickets(a, b, sort.key) * (sort.dir === 'asc' ? 1 : -1));
    }
    return result;
  }, [tickets, search, status, submitter, dateFrom, dateTo, sort]);

  const pager = usePagination(filtered, JSON.stringify([search, status, submitter, dateFrom, dateTo, sort]));
  const hasFilters = search !== '' || status !== 'all' || submitter !== 'all' || dateFrom !== '' || dateTo !== '';

  function clearFilters() {
    setSearch('');
    setStatus('all');
    setSubmitter('all');
    setDateFrom('');
    setDateTo('');
  }

  async function handleDelete(ticket: Ticket) {
    if (!onDelete) return;
    if (!window.confirm(`Delete ticket ${ticket.id} "${ticket.title}"? This also removes its messages and attachments.`)) {
      return;
    }
    setDeletingId(ticket.id);
    setError(null);
    try {
      await onDelete(ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete ticket.');
    } finally {
      setDeletingId(null);
    }
  }

  if (tickets.length === 0) {
    return <div className="empty-state">No tickets yet.</div>;
  }

  const header = (key: SortKey, label: string) => (
    <SortHeader label={label} sortKey={key} sort={sort} onToggle={toggleSort} testIdPrefix="ticket" />
  );

  return (
    <div>
      <div className="table-toolbar" data-testid="ticket-filters">
        <input
          type="search"
          className="form-input toolbar-search"
          placeholder="Search ticket ID or title…"
          aria-label="Search ticket ID or title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="ticket-filter-search"
        />
        <select
          className="form-input"
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value as TicketStatus | 'all')}
          data-testid="ticket-filter-status"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="answered">Answered</option>
          <option value="closed">Closed</option>
        </select>
        {showSubmitter && (
          <select
            className="form-input"
            aria-label="Filter by submitter"
            value={submitter}
            onChange={(e) => setSubmitter(e.target.value)}
            data-testid="ticket-filter-submitter"
          >
            <option value="all">All submitters</option>
            {submitters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <label className="toolbar-date">
          <span>From</span>
          <input
            type="date"
            className="form-input"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            data-testid="ticket-filter-date-from"
          />
        </label>
        <label className="toolbar-date">
          <span>To</span>
          <input
            type="date"
            className="form-input"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            data-testid="ticket-filter-date-to"
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          onClick={clearFilters}
          disabled={!hasFilters}
          data-testid="ticket-filter-clear"
        >
          Clear filters
        </Button>
      </div>

      {error && <div className="form-message error">{error}</div>}

      {filtered.length === 0 ? (
        <div className="empty-state" data-testid="ticket-filter-empty">
          No tickets match your filters.
        </div>
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {header('id', 'Ticket ID')}
                  {header('title', 'Title')}
                  {showSubmitter && header('submittedByName', 'Submitted by')}
                  {header('status', 'Status')}
                  {header('updatedAt', 'Updated')}
                  {onDelete && <th aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {pager.pageRows.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className={ticket.id === selectedId ? 'selected' : ''}
                    onClick={() => onSelect(ticket)}
                    data-testid={`ticket-row-${ticket.id}`}
                  >
                    <td>{ticket.id}</td>
                    <td>{ticket.title}</td>
                    {showSubmitter && <td>{ticket.submittedByName}</td>}
                    <td>
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td>{new Date(ticket.updatedAt).toLocaleString()}</td>
                    {onDelete && (
                      <td>
                        <Button
                          type="button"
                          variant="danger"
                          disabled={deletingId === ticket.id}
                          onClick={(e) => {
                            // Keep the row's own click (open details) from firing too.
                            e.stopPropagation();
                            handleDelete(ticket);
                          }}
                          data-testid={`ticket-delete-${ticket.id}`}
                        >
                          {deletingId === ticket.id ? 'Deleting…' : 'Delete'}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={pager.page}
            pageCount={pager.pageCount}
            pageStart={pager.pageStart}
            shown={pager.pageRows.length}
            total={pager.total}
            onPageChange={pager.setPage}
            testIdPrefix="ticket"
          />
        </>
      )}
    </div>
  );
}
