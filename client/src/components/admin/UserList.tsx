import { useMemo, useState } from 'react';
import { Button } from '../common/Button';
import { Pagination, SortHeader, compareText, usePagination, useSort } from '../common/tableControls';
import type { PublicUser, Role } from '../../types';

type SortKey = 'name' | 'email' | 'role';

export function UserList({
  users,
  onSelect,
  selectedId,
  currentUserId,
  onDelete,
}: {
  users: PublicUser[];
  onSelect: (user: PublicUser) => void;
  selectedId?: string;
  // The signed-in admin — their own row gets no Delete button (the server
  // refuses self-deletion too).
  currentUserId?: string;
  onDelete?: (user: PublicUser) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | 'all'>('all');
  const [sort, toggleSort] = useSort<SortKey>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = users.filter((user) => {
      if (role !== 'all' && user.role !== role) return false;
      if (query && !user.name.toLowerCase().includes(query) && !user.email.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
    if (sort) {
      result.sort((a, b) => compareText(a[sort.key], b[sort.key]) * (sort.dir === 'asc' ? 1 : -1));
    }
    return result;
  }, [users, search, role, sort]);

  const pager = usePagination(filtered, JSON.stringify([search, role, sort]));
  const hasFilters = search !== '' || role !== 'all';

  async function handleDelete(user: PublicUser) {
    if (!onDelete) return;
    if (
      !window.confirm(
        `Delete ${user.name} (${user.email})? Their tickets, messages and uploaded files are deleted too. This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingId(user.id);
    setError(null);
    try {
      await onDelete(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user.');
    } finally {
      setDeletingId(null);
    }
  }

  if (users.length === 0) {
    return <div className="empty-state">No users found.</div>;
  }

  const header = (key: SortKey, label: string) => (
    <SortHeader label={label} sortKey={key} sort={sort} onToggle={toggleSort} testIdPrefix="user" />
  );

  return (
    <div>
      <div className="table-toolbar" data-testid="user-filters">
        <input
          type="search"
          className="form-input toolbar-search"
          placeholder="Search name or email…"
          aria-label="Search name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="user-filter-search"
        />
        <select
          className="form-input"
          aria-label="Filter by role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role | 'all')}
          data-testid="user-filter-role"
        >
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setSearch('');
            setRole('all');
          }}
          disabled={!hasFilters}
          data-testid="user-filter-clear"
        >
          Clear filters
        </Button>
      </div>

      {error && <div className="form-message error">{error}</div>}

      {filtered.length === 0 ? (
        <div className="empty-state" data-testid="user-filter-empty">
          No users match your filters.
        </div>
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {header('name', 'Name')}
                  {header('email', 'Email')}
                  {header('role', 'Role')}
                  {onDelete && <th aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {pager.pageRows.map((user) => (
                  <tr
                    key={user.id}
                    className={user.id === selectedId ? 'selected' : ''}
                    onClick={() => onSelect(user)}
                    data-testid={`user-row-${user.id}`}
                  >
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td style={{ textTransform: 'capitalize' }}>{user.role}</td>
                    {onDelete && (
                      <td>
                        {user.id !== currentUserId && (
                          <Button
                            type="button"
                            variant="danger"
                            disabled={deletingId === user.id}
                            onClick={(e) => {
                              // Keep the row's own click (open editor) from firing too.
                              e.stopPropagation();
                              handleDelete(user);
                            }}
                            data-testid={`user-delete-${user.id}`}
                          >
                            {deletingId === user.id ? 'Deleting…' : 'Delete'}
                          </Button>
                        )}
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
            testIdPrefix="user"
          />
        </>
      )}
    </div>
  );
}
