import { useMemo, useState } from 'react';
import { Button } from '../common/Button';
import { Pagination, SortHeader, compareText, usePagination, useSort } from '../common/tableControls';
import { attachmentsApi } from '../../api/attachments';
import { formatFileSize } from './formatFileSize';
import type { Attachment, Role } from '../../types';

type SortKey = 'fileName' | 'topic' | 'uploadedByName' | 'uploadedByRole' | 'createdAt' | 'size';

const KB = 1024;
const MB = 1024 * KB;

// Uploads are capped at 10 MB each (server/src/middleware/upload.ts), so
// these three ranges cover everything that can exist.
const SIZE_RANGES = {
  small: { label: 'Under 100 KB', test: (bytes: number) => bytes < 100 * KB },
  medium: { label: '100 KB – 1 MB', test: (bytes: number) => bytes >= 100 * KB && bytes < MB },
  large: { label: 'Over 1 MB', test: (bytes: number) => bytes >= MB },
} as const;
type SizeRange = keyof typeof SIZE_RANGES;

function compareAttachments(a: Attachment, b: Attachment, key: SortKey): number {
  switch (key) {
    case 'size':
      return a.size - b.size;
    case 'createdAt':
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    default:
      return compareText(a[key], b[key]);
  }
}

export function FileTable({
  attachments,
  currentUserId,
  isAdmin,
  deletingId,
  onDelete,
}: {
  attachments: Attachment[];
  currentUserId?: string;
  isAdmin: boolean;
  deletingId: string | null;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | 'all'>('all');
  // An uploader's user id ('all' = everyone).
  const [uploader, setUploader] = useState('all');
  const [size, setSize] = useState<SizeRange | 'all'>('all');
  const [sort, toggleSort] = useSort<SortKey>();

  // Keyed by id, labelled by name — two users can share a display name.
  const uploaders = useMemo(() => {
    const byId = new Map<string, string>();
    for (const a of attachments) byId.set(a.uploadedBy, a.uploadedByName);
    return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => compareText(a.name, b.name));
  }, [attachments]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = attachments.filter((a) => {
      if (role !== 'all' && a.uploadedByRole !== role) return false;
      if (uploader !== 'all' && a.uploadedBy !== uploader) return false;
      if (size !== 'all' && !SIZE_RANGES[size].test(a.size)) return false;
      if (query && !a.fileName.toLowerCase().includes(query) && !a.topic.toLowerCase().includes(query)) return false;
      return true;
    });
    if (sort) {
      result.sort((a, b) => compareAttachments(a, b, sort.key) * (sort.dir === 'asc' ? 1 : -1));
    }
    return result;
  }, [attachments, search, role, uploader, size, sort]);

  const pager = usePagination(filtered, JSON.stringify([search, role, uploader, size, sort]));
  const hasFilters = search !== '' || role !== 'all' || uploader !== 'all' || size !== 'all';

  function clearFilters() {
    setSearch('');
    setRole('all');
    setUploader('all');
    setSize('all');
  }

  const header = (key: SortKey, label: string) => (
    <SortHeader label={label} sortKey={key} sort={sort} onToggle={toggleSort} testIdPrefix="file-repo" />
  );

  return (
    <div>
      <div className="table-toolbar" data-testid="file-repo-filters">
        <input
          type="search"
          className="form-input toolbar-search"
          placeholder="Search file name or topic…"
          aria-label="Search file name or topic"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="file-repo-filter-search"
        />
        <select
          className="form-input"
          aria-label="Filter by role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role | 'all')}
          data-testid="file-repo-filter-role"
        >
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        <select
          className="form-input"
          aria-label="Filter by uploader"
          value={uploader}
          onChange={(e) => setUploader(e.target.value)}
          data-testid="file-repo-filter-uploader"
        >
          <option value="all">All uploaders</option>
          {uploaders.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          className="form-input"
          aria-label="Filter by size"
          value={size}
          onChange={(e) => setSize(e.target.value as SizeRange | 'all')}
          data-testid="file-repo-filter-size"
        >
          <option value="all">All sizes</option>
          {(Object.keys(SIZE_RANGES) as SizeRange[]).map((key) => (
            <option key={key} value={key}>
              {SIZE_RANGES[key].label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          onClick={clearFilters}
          disabled={!hasFilters}
          data-testid="file-repo-filter-clear"
        >
          Clear filters
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" data-testid="file-repo-filter-empty">
          No files match your filters.
        </div>
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table" data-testid="file-repo-table">
              <thead>
                <tr>
                  {header('fileName', 'File Name')}
                  {header('topic', 'Topic')}
                  {header('uploadedByName', 'Uploaded By')}
                  {header('uploadedByRole', 'Role')}
                  {header('createdAt', 'Uploaded At')}
                  {header('size', 'Size')}
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {pager.pageRows.map((attachment) => {
                  const canDelete = isAdmin || attachment.uploadedBy === currentUserId;
                  return (
                    <tr key={attachment.id} data-testid={`file-repo-row-${attachment.id}`}>
                      <td>
                        <a
                          href={attachmentsApi.downloadUrl(attachment.id)}
                          target="_blank"
                          rel="noreferrer"
                          data-testid="file-repo-download-link"
                        >
                          {attachment.fileName}
                        </a>
                      </td>
                      <td>{attachment.topic}</td>
                      <td>{attachment.uploadedByName}</td>
                      <td>
                        <span className="role-tag" data-testid="file-repo-role">
                          {attachment.uploadedByRole}
                        </span>
                      </td>
                      <td>{new Date(attachment.createdAt).toLocaleString()}</td>
                      <td>{formatFileSize(attachment.size)}</td>
                      <td>
                        {canDelete && (
                          <Button
                            type="button"
                            variant="danger"
                            disabled={deletingId === attachment.id}
                            onClick={() => onDelete(attachment.id)}
                            data-testid={`file-repo-delete-${attachment.id}`}
                          >
                            {deletingId === attachment.id ? 'Deleting…' : 'Delete'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
            testIdPrefix="file-repo"
          />
        </>
      )}
    </div>
  );
}
