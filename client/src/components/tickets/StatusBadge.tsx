import type { TicketStatus } from '../../types';

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`status-badge ${status}`}>{status}</span>;
}

